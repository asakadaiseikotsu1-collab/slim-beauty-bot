function calcBMIAndPrediction(q2text) {
  try {
    const heightMatch = q2text.match(/(\d+\.?\d*)\s*cm/);
    const weightMatch = q2text.match(/(\d+\.?\d*)\s*kg/);
    if (!heightMatch || !weightMatch) return null;
    const height = parseFloat(heightMatch[1]) / 100;
    const weight = parseFloat(weightMatch[1]);
    const bmi = weight / (height * height);
    const m1 = Math.round((-0.17 * bmi + 1.30) * 10) / 10;
    const m2 = Math.round((-0.28 * bmi + 2.01) * 10) / 10;
    const m3 = Math.round((-0.39 * bmi + 3.42) * 10) / 10;
    const total = Math.round((m1 + m2 + m3) * 10) / 10;
    return { bmi: Math.round(bmi * 10) / 10, m1, m2, m3,
