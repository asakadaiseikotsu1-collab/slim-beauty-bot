const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const {
  getSystemPrompt,
  QUESTIONS,
  GREETING,
  HUMAN_HANDOFF,
  HANDOFF_FOLLOW,
  FEMALE_STAFF_REPLY,
  FOLLOW_24H,
  FOLLOW_3DAYS,
  BEFORE_VISIT,
  generateReport
} = require('./prompts');

const app = express();
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const STAFF_LINE_ID = process.env.STAFF_LINE_USER_ID;
const BOOKING_URL = process.env.BOOKING_URL || 'https://YOUR_BOOKING_URL';

// ── セッション管理 ────────────────────────────────────────────
const userSessions = {};

function getSession(userId) {
  if (!userSessions[userId]) {
    userSessions[userId] = {
      step: 0,
      name: '',
      answers: {},
      history: [],
      counselingCount: 0,
      honestyMoments: [],
      handoffSentAt: null,    // 予約案内を送った時刻
      inviteSent: false,      // 来院誘導を送信済みか（1回のみ）
      followUpSent: false,    // 24hフォロー送信済みか
      follow3daySent: false   // 3日後フォロー送信済みか
    };
  }
  return userSessions[userId];
}

// ── LINE返信 ──────────────────────────────────────────────────
async function replyToLine(replyToken, messages) {
  const msgs = Array.isArray(messages) ? messages : [messages];
  await axios.post('https://api.line.me/v2/bot/message/reply', {
    replyToken,
    messages: msgs.map(text => ({ type: 'text', text }))
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`
    }
  });
}

// ── プッシュメッセージ（フォローアップ用）────────────────────
async function pushToUser(userId, message) {
  await axios.post('https://api.line.me/v2/bot/message/push', {
    to: userId,
    messages: [{ type: 'text', text: message }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`
    }
  });
}

// ── スタッフにプッシュ通知 ────────────────────────────────────
async function pushToStaff(message) {
  if (!STAFF_LINE_ID) return;
  await axios.post('https://api.line.me/v2/bot/message/push', {
    to: STAFF_LINE_ID,
    messages: [{ type: 'text', text: message }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`
    }
  });
}

// ── Claude API ────────────────────────────────────────────────
async function callClaude(systemPrompt, history) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: history
  });
  return response.content[0].text;
}

// ── 診断実行 ──────────────────────────────────────────────────
async function runDiagnosis(session) {
  const a = session.answers;
  const userPrompt = `
以下は${session.name}さんの診断回答です。

年齢：${a.q1}
気になる部位：${a.q2}
ダイエット経験：${a.q3}
体型が気になり始めた時期：${a.q4}
今一番つらいこと：${a.q5}

指定のフォーマットで診断結果を作成してください。
`.trim();

  const result = await callClaude(
    getSystemPrompt('diagnosis', { ...a, name: session.name }),
    [{ role: 'user', content: userPrompt }]
  );

  session.history.push({ role: 'user', content: userPrompt });
  session.history.push({ role: 'assistant', content: result });
  session.step = 6;

  return result;
}

// ── なりたい未来の共感メッセージ生成 ─────────────────────────
async function runFutureBridge(session) {
  const a = session.answers;
  const userPrompt = `${session.name}さんの診断が終わりました。なりたい未来への橋渡しメッセージを生成してください。`;

  const result = await callClaude(
    getSystemPrompt('future_bridge', { ...a, name: session.name }),
    [{ role: 'user', content: userPrompt }]
  );

  session.history.push({ role: 'assistant', content: result });
  return result;
}

// ── カウンセリング実行 ────────────────────────────────────────
async function runCounseling(session, userMessage) {
  session.history.push({ role: 'user', content: userMessage });
  session.counselingCount++;

  const reply = await callClaude(
    getSystemPrompt('flow', { ...session.answers, name: session.name, bookingUrl: BOOKING_URL }),
    session.history
  );

  session.history.push({ role: 'assistant', content: reply });

  // 本音ワードを記録
  const emotionWords = ['したい', '辛い', 'つらい', '嬉しい', '痛い', '不安', '怖い', '悲しい', '恥ずかしい'];
  if (emotionWords.some(w => userMessage.includes(w))) {
    session.honestyMoments.push(userMessage);
  }

  return reply;
}

// ── 人間誘導判定 ──────────────────────────────────────────────
const HANDOFF_KEYWORDS = ['相談したい', '予約', '直接', '会いたい', '行きたい', '申し込み', '来院'];
const FEMALE_KEYWORDS = ['女性', '女の人', 'レディース', '女'];

function shouldHandoff(session, message) {
  if (session.inviteSent) return false; // 誘導は1回のみ
  return HANDOFF_KEYWORDS.some(kw => message.includes(kw));
}

function askingAboutFemaleStaff(message) {
  return FEMALE_KEYWORDS.some(kw => message.includes(kw));
}

// ── フォローアップスケジューラー ────────────────────────────
function scheduleFollowUps(userId, session) {
  // 24時間後フォロー
  setTimeout(async () => {
    if (!session.followUpSent && session.handoffSentAt) {
      session.followUpSent = true;
      await pushToUser(userId, FOLLOW_24H(session.name, BOOKING_URL)).catch(() => {});
    }
  }, 24 * 60 * 60 * 1000);

  // 3日後フォロー
  setTimeout(async () => {
    if (!session.follow3daySent && session.handoffSentAt) {
      session.follow3daySent = true;
      await pushToUser(userId, FOLLOW_3DAYS(session.name, BOOKING_URL)).catch(() => {});
    }
  }, 3 * 24 * 60 * 60 * 1000);
}

// ── メイン会話ロジック ────────────────────────────────────────
async function handleMessage(userId, replyToken, userMessage) {
  const session = getSession(userId);

  // STEP 0: 挨拶
  if (session.step === 0) {
    session.step = 0.5;
    await replyToLine(replyToken, GREETING);
    return;
  }

  // STEP 0.5: 名前を受け取る
  if (session.step === 0.5) {
    session.name = userMessage.replace(/さん|様/g, '').trim();
    session.step = 1;
    await replyToLine(replyToken, QUESTIONS[1](session.name));
    return;
  }

  // STEP 1〜5: 診断質問
  if (session.step >= 1 && session.step <= 5) {
    session.answers[`q${session.step}`] = userMessage;

    if (session.step < 5) {
      session.step++;
      await replyToLine(replyToken, QUESTIONS[session.step](session.name));
    } else {
      // replyToken は wait メッセージだけに使う（1回しか使えない）
      await replyToLine(replyToken,
        `${session.name}さん、お話を聞かせてもらいました✨\n少しだけお待ちください…`
      );

      // 以降は pushToUser で連続送信
      const diagnosis = await runDiagnosis(session);
      await pushToUser(userId, diagnosis);

      const futureBridge = await runFutureBridge(session);
      await pushToUser(userId, futureBridge);

      // 来院誘導を自動送信（1回のみ）
      session.inviteSent = true;
      session.handoffSentAt = new Date();
      await pushToUser(userId, HUMAN_HANDOFF(session.name, BOOKING_URL));

      // スタッフにレポート送信
      const report = generateReport(
        { ...session.answers, name: session.name },
        diagnosis,
        session.honestyMoments
      );
      await pushToStaff(report);
      scheduleFollowUps(userId, session);
    }
    return;
  }

  // STEP 6: 来院誘導後のフォロー会話
  // （来院誘導は診断完了時に自動送信済みのため、ここでは質問・返事への対応のみ）
  if (session.step === 6) {

    // 女性スタッフについての質問
    if (askingAboutFemaleStaff(userMessage)) {
      await replyToLine(replyToken, FEMALE_STAFF_REPLY(session.name, BOOKING_URL));
      return;
    }

    // 診断前に予約キーワードが来た場合（inviteSent前のみ）
    if (shouldHandoff(session, userMessage)) {
      session.inviteSent = true;
      session.handoffSentAt = new Date();
      await replyToLine(replyToken, HUMAN_HANDOFF(session.name, BOOKING_URL));
      scheduleFollowUps(userId, session);
      return;
    }

    // 通常会話（来院への返事・質問への対応など）
    const reply = await runCounseling(session, userMessage);
    await replyToLine(replyToken, reply);
    return;
  }
}

// ── LINE Webhook ──────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const events = req.body.events || [];
  for (const event of events) {   
     // フォローイベント（自動起動しない）
if (event.type === 'follow') {
  continue;
} 

    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const userId = event.source.userId;
    const replyToken = event.replyToken;
    const userMessage = event.message.text.trim();
// 体質診断スタートでスルルン起動（診断中はリセットしない）
    if (userMessage === '体質診断スタート') {
      const session = getSession(userId);
      if (session.step > 0) {
        // すでに診断が始まっている場合はそのまま続ける
        const name = session.name || '';
        const msg = name
          ? `${name}さん、診断はもう始まっていますよ😊\n続きから話しましょう！`
          : '診断はもう始まっていますよ😊\n続きから話しましょう！';
        await replyToLine(replyToken, msg).catch(() => {});
        continue;
      }
      session.step = 0.5;
      await replyToLine(replyToken, GREETING).catch(() => {});
      continue;
    }
    try {
      await handleMessage(userId, replyToken, userMessage);
    } catch (err) {
      console.error('Error:', err.message);
      await replyToLine(replyToken,
        '申し訳ありません、少し時間をおいてもう一度送ってみてください。'
      ).catch(() => {});
    }
  }
});

// ── ヘルスチェック ────────────────────────────────────────────
app.get('/', (req, res) => res.send('スルルン is running 😊'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`スルルン起動中 ポート:${PORT}`));
