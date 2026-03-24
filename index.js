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
身長・体重：${a.q2}
気になる部位：${a.q3}
ダイエット経験：${a.q4}
太り始めた時期：${a.q5}
理想の体重・体型：${a.q6}
痩せたら嬉しいこと：${a.q7}

指定のフォーマットで診断結果を作成してください。
`.trim();

  const result = await callClaude(
    getSystemPrompt('diagnosis', { ...a, name: session.name }),
    [{ role: 'user', content: userPrompt }]
  );

  session.history.push({ role: 'user', content: userPrompt });
  session.history.push({ role: 'assistant', content: result });
  session.step = 8;

  return result;
}

// ── カウンセリング実行 ────────────────────────────────────────
async function runCounseling(session, userMessage) {
  session.history.push({ role: 'user', content: userMessage });
  session.counselingCount++;

  const reply = await callClaude(
    getSystemPrompt('counseling', { ...session.answers, name: session.name }),
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
  if (session.counselingCount >= 5) return true;
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

  // STEP 1〜7: 診断質問
  if (session.step >= 1 && session.step <= 7) {
    session.answers[`q${session.step}`] = userMessage;

    if (session.step < 7) {
      session.step++;
      await replyToLine(replyToken, QUESTIONS[session.step](session.name));
    } else {
      await replyToLine(replyToken,
        `回答ありがとうございます${session.name}さん😊\n診断しています、少々お待ちください…`
      );
      const diagnosis = await runDiagnosis(session);
      await replyToLine(replyToken, diagnosis);
    }
    return;
  }

  // STEP 8: カウンセリング〜予約誘導
  if (session.step === 8) {

    // 女性スタッフについての質問
    if (askingAboutFemaleStaff(userMessage)) {
      await replyToLine(replyToken, FEMALE_STAFF_REPLY(session.name, BOOKING_URL));
      return;
    }

    // 予約誘導タイミング
    if (shouldHandoff(session, userMessage)) {
      // スタッフにレポート送信
      const report = generateReport(
        { ...session.answers, name: session.name },
        session.history.find(h => h.role === 'assistant')?.content || '',
        session.honestyMoments
      );
      await pushToStaff(report);

      // 予約案内を送信
      await replyToLine(replyToken, HUMAN_HANDOFF(session.name, BOOKING_URL));

      // 送信時刻を記録してフォローアップをスケジュール
      session.handoffSentAt = new Date();
      scheduleFollowUps(userId, session);

      // 少し間を置いてフォローメッセージを送る
      setTimeout(async () => {
        await pushToUser(userId, HANDOFF_FOLLOW(session.name)).catch(() => {});
      }, 3 * 60 * 1000); // 3分後

      return;
    }

    // 通常カウンセリング
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
// 体質診断スタートでスルルン起動
    if (userMessage === '体質診断スタート') {
      const session = getSession(userId);
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
