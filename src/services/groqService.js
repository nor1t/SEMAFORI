import Groq from 'groq-sdk';

const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;

if (!groqApiKey) {
  console.warn('VITE_GROQ_API_KEY not found. AI features will be disabled.');
}

export const groq = groqApiKey ? new Groq({
  apiKey: groqApiKey,
  dangerouslyAllowBrowser: true
}) : null;

export const generateTrafficAdvice = async (incidentData) => {
  if (!groq) {
    return "AI features are not available. Please set VITE_GROQ_API_KEY in your environment.";
  }

  try {
    const prompt = `As a traffic management AI assistant, provide brief, actionable advice for this traffic incident:

Incident Details:
- Type: ${incidentData.type}
- Severity: ${incidentData.severity}
- Description: ${incidentData.description}
- Status: ${incidentData.status}

Provide 2-3 specific recommendations for handling this incident. Keep it concise and professional.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'mixtral-8x7b-32768',
      temperature: 0.7,
      max_tokens: 300,
    });

    return completion.choices[0]?.message?.content || "Unable to generate advice at this time.";
  } catch (error) {
    console.error('Groq API error:', error);
    return "Sorry, I couldn't generate advice right now. Please try again later.";
  }
};

export const analyzeTrafficPattern = async (reports) => {
  if (!groq) {
    return "AI features are not available.";
  }

  try {
    const reportSummary = reports.map(r => `${r.type}: ${r.severity} (${r.status})`).join(', ');
    const prompt = `Analyze this traffic incident pattern and provide insights:

Recent incidents: ${reportSummary}

Provide a brief analysis of traffic patterns and any recommendations. Keep it under 200 words.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'mixtral-8x7b-32768',
      temperature: 0.6,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content || "Unable to analyze patterns.";
  } catch (error) {
    console.error('Groq API error:', error);
    return "Analysis unavailable.";
  }
};