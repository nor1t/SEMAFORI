import Groq from 'groq-sdk';

const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.1-8b-instant';

if (!groqApiKey) {
  console.warn('VITE_GROQ_API_KEY not found. AI features will fall back to local responses.');
}

export const groq = groqApiKey
  ? new Groq({
      apiKey: groqApiKey,
      dangerouslyAllowBrowser: true,
    })
  : null;

const keywordMatch = (text, keywords) => {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
};

const buildReportSummary = (reports, language) => {
  if (!reports.length) {
    return language === 'english'
      ? 'There are currently no incident reports in the system.'
      : 'Aktualisht nuk ka raporte incidenti në sistem.';
  }

  const activeCount = reports.filter((report) => report.status === 'active').length;
  const controlCount = reports.filter((report) => report.status === 'under_control').length;
  const clearedCount = reports.filter((report) => report.status === 'cleared').length;
  const latest = reports[0];

  if (language === 'english') {
    return `There are ${reports.length} reports in total: ${activeCount} active, ${controlCount} under control, and ${clearedCount} cleared. The latest incident is "${latest.title}" with ${latest.severity} severity and ${latest.status} status.`;
  }

  return `Ka ${reports.length} raporte gjithsej: ${activeCount} aktive, ${controlCount} nën kontroll dhe ${clearedCount} të pastruara. Incidenti më i fundit është "${latest.title}" me rëndësi ${latest.severity} dhe status ${latest.status}.`;
};

const buildLocalFallback = ({ message, reports, language }) => {
  const normalizedMessage = message.toLowerCase();
  const latestIncident = reports[0];
  const summary = buildReportSummary(reports, language);

  const adviceRequest = keywordMatch(normalizedMessage, [
    'advice',
    'recommend',
    'latest incident',
    'këshill',
    'keshill',
    'rekomand',
    'incidentin e fundit',
  ]);

  const analysisRequest = keywordMatch(normalizedMessage, [
    'analyze',
    'analysis',
    'pattern',
    'summary',
    'analizo',
    'analiz',
    'model',
    'përmbledh',
    'permbledh',
  ]);

  if (!reports.length) {
    return language === 'english'
      ? 'No traffic incidents are available yet. Create a report first so I can analyze patterns or recommend actions.'
      : 'Nuk ka ende incidente trafiku. Krijo fillimisht një raport që të mund të analizoj modelet ose të rekomandoj veprime.';
  }

  if (adviceRequest && latestIncident) {
    if (language === 'english') {
      return `For the latest incident "${latestIncident.title}", prioritize scene verification, keep status updates frequent, and inform affected drivers early. If the incident remains active, consider a diversion and monitor whether severity or affected area changes.`;
    }

    return `Për incidentin më të fundit "${latestIncident.title}", verifiko menjëherë situatën në terren, përditëso statusin rregullisht dhe njofto drejtuesit e prekur sa më herët. Nëse incidenti mbetet aktiv, konsidero devijime dhe monitoro nëse ndryshon rëndësia ose zona e prekur.`;
  }

  if (analysisRequest) {
    if (language === 'english') {
      return `${summary} Focus first on active incidents, then review the under-control group for closure opportunities.`;
    }

    return `${summary} Fokusi kryesor duhet të jetë te incidentet aktive, ndërsa incidentet nën kontroll duhen rishikuar për mbyllje sa më të shpejtë.`;
  }

  if (language === 'english') {
    return `${summary} In general, keep reports consistent, capture location precisely, and move incidents from active to cleared only after confirmation from the response team.`;
  }

  return `${summary} Në përgjithësi, mbaji raportet të qëndrueshme, shëno vendndodhjen sa më saktë dhe kalo incidentet nga aktiv në të pastruar vetëm pas konfirmimit nga ekipi i reagimit.`;
};

const getGroqErrorType = (error) => {
  const message = `${error?.message || ''}`.toLowerCase();

  if (error?.status === 401 || message.includes('invalid api key') || message.includes('authentication')) {
    return 'auth';
  }

  if (message.includes('timeout')) {
    return 'timeout';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'network';
  }

  return 'generic';
};

export const askTrafficAssistant = async ({ message, reports = [], language = 'albanian' }) => {
  const fallbackContent = buildLocalFallback({ message, reports, language });

  if (!groq) {
    return {
      content: fallbackContent,
      provider: 'fallback',
      errorType: 'auth',
    };
  }

  const summary = buildReportSummary(reports, language);
  const systemPrompt = language === 'english'
    ? 'You are a concise traffic management assistant. Use the supplied incident context when relevant and give actionable, operational answers.'
    : 'Ti je një asistent konciz për menaxhimin e trafikut. Përdor kontekstin e incidenteve kur është i dobishëm dhe jep përgjigje praktike e operative.';
  const userPrompt = language === 'english'
    ? `Current incident context: ${summary}\n\nUser question: ${message}\n\nAnswer in English, keep it practical, and mention next steps when useful.`
    : `Konteksti aktual i incidenteve: ${summary}\n\nPyetja e përdoruesit: ${message}\n\nPërgjigju në shqip, në mënyrë praktike, dhe përmend hapat e radhës kur është e dobishme.`;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_completion_tokens: 300,
    });

    return {
      content: completion.choices[0]?.message?.content || fallbackContent,
      provider: 'groq',
      errorType: null,
    };
  } catch (error) {
    console.error('Groq API error:', error);

    return {
      content: fallbackContent,
      provider: 'fallback',
      errorType: getGroqErrorType(error),
    };
  }
};

export const generateTrafficAdvice = async (incidentData, language = 'albanian') => {
  const response = await askTrafficAssistant({
    message: language === 'english'
      ? `Give incident handling advice for this case: ${incidentData?.title || ''}`
      : `Jep këshilla për menaxhimin e këtij incidenti: ${incidentData?.title || ''}`,
    reports: incidentData ? [incidentData] : [],
    language,
  });

  return response.content;
};

export const analyzeTrafficPattern = async (reports, language = 'albanian') => {
  const response = await askTrafficAssistant({
    message: language === 'english'
      ? 'Analyze current traffic patterns and summarize the main operational insights.'
      : 'Analizo modelet aktuale të trafikut dhe përmblidh njohuritë kryesore operative.',
    reports,
    language,
  });

  return response.content;
};
