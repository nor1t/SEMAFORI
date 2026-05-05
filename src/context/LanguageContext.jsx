import React, { createContext, useState, useContext, useEffect } from 'react';

const LanguageContext = createContext();

export const translations = {
  albanian: {
    // Dashboard
    totalReports: 'Total raportet',
    active: 'Aktiv',
    cleared: 'Pastruar',
    underControl: 'Nën Kontroll',
    reportIncident: 'Raporti i incidentit',
    createNewTrafficAlert: 'Krijo një alarm trafiku të ri',
    editMode: 'Modaliteti i redaktimit',
    newReport: 'Raport i ri',
    incidentTitle: 'Titulli i incidentit',
    enterTitle: 'Mbyllja e rrugës në M4',
    category: 'Kategoria',
    description: 'Përshkrimi',
    addDetails: 'Shto detaje për incidentin dhe përgjigjen e rekomanduar.',
    severity: 'Rëndësia',
    status: 'Statusi',
    addIncident: 'Shto incidentin',
    updateReport: 'Përditëso raportin',
    cancelEdit: 'Anulo redaktimin',
    recentIncidents: 'Incidentet e fundit',
    reportFlow: 'Rrjedha e raporteve',
    noReports: 'Ende nuk ka raporte incidenti. Përdor formularin për të shtuar një dhe monitoro kushtet e trafikut.',
    edit: 'Redakto',
    delete: 'Fshi',
    confirm: 'Fshi këtë raport incidenti?',
    titleRequired: 'Titulli është i nevojshëm.',
    offline: 'Jeni offline. Kontrolloni lidhjen tuaj të internetit dhe provoni përsëri.',
    timeout: 'Kërkesa ka skaduar. Provoni përsëri.',
    networkError: 'Problem me lidhjen. Kontrolloni internetin dhe provoni përsëri.',
    successMessage: 'Raporti juaj u regjistrua me sukses! ✓',
    updateSuccess: 'Incidenti u përditësua me sukses.',
    deleteSuccess: 'Incidenti u hoq nga paneli yt.',
    errorSave: 'Nuk mund të ruhet incidenti.',
    errorUpdate: 'Nuk mund të përditësohet incidenti në Supabase.',
    errorDelete: 'Nuk mund të hiqet incidenti nga Supabase.',
    errorFetch: 'Nuk mund të ngarkohen raportet nga Supabase.',
    liveTrafficMap: 'Harta e trafikut live',
    currentOperations: 'Operacionet aktuale',
    trafficOverview: 'Pamja e përgjithshme e rrjedhës së trafikut',
    affectedCorridor: 'Korridori më i prekur',
    mainIncident: 'Incidenti kryesor',
    systemHealth: 'Shëndeti i sistemit',
    route: 'Rruga I-95',
    heavyTraffic: 'Shumë vonesa për shkak të mbylljes së korsisë dhe trafikut të rëndë.',
    northHub: 'Aksident në Veri Hub',
    responseTeam: 'Ekipi i përgjigjes u dërgua. Pastrimi i parashikuar në 45 min.',
    stable: 'Stabil',
    allSystems: 'Të gjitha sistemet e monitorimit po funksionojnë normalisht.',
    saving: 'Duke ruajtur...',
    noDetails: 'Nuk janë dhënë detaje shtesë.',
    retry: 'Duke provuar përsëri...',
    
    // Settings
    settings: 'Konfigurimet',
    personalizeExperience: 'Personalizo përvojën tënde',
    theme: 'Tema',
    light: 'Drita',
    lightTheme: 'Ndriçim i lehtë',
    dark: 'Errësira',
    darkTheme: 'Ndriçim i errët',
    language: 'Gjuha',
    albanian: 'Shqiptare',
    english: 'Anglezi',
    notifications: 'Njoftime',
    enable: 'Aktivizo',
    disable: 'Çaktivizo',
    autoSave: 'Ruajtja Automatike',
    
    // Incident types
    accident: 'Aksident',
    construction: 'Konstruksion',
    heavyTraffic: 'Trafik i Rëndë',
    weather: 'Moti',
    
    // Severity
    minor: 'Minore',
    moderate: 'Moderate',
    major: 'Madhore',
  },
  english: {
    // Dashboard
    totalReports: 'Total Reports',
    active: 'Active',
    cleared: 'Cleared',
    underControl: 'Under Control',
    reportIncident: 'Incident Report',
    createNewTrafficAlert: 'Create a New Traffic Alert',
    editMode: 'Edit Mode',
    newReport: 'New Report',
    incidentTitle: 'Incident Title',
    enterTitle: 'Road closure on M4',
    category: 'Category',
    description: 'Description',
    addDetails: 'Add details about the incident and recommended response.',
    severity: 'Severity',
    status: 'Status',
    addIncident: 'Add Incident',
    updateReport: 'Update Report',
    cancelEdit: 'Cancel Edit',
    recentIncidents: 'Recent Incidents',
    reportFlow: 'Report Flow',
    noReports: 'No incident reports yet. Use the form to add one and monitor traffic conditions.',
    edit: 'Edit',
    delete: 'Delete',
    confirm: 'Delete this incident report?',
    titleRequired: 'Title is required.',
    offline: 'You are offline. Check your internet connection and try again.',
    timeout: 'Request timed out. Please try again.',
    networkError: 'Connection problem. Check your internet and try again.',
    successMessage: 'Your report has been recorded successfully! ✓',
    updateSuccess: 'Incident updated successfully.',
    deleteSuccess: 'Incident removed from your dashboard.',
    errorSave: 'Cannot save incident.',
    errorUpdate: 'Cannot update incident in Supabase.',
    errorDelete: 'Cannot delete incident from Supabase.',
    errorFetch: 'Cannot load reports from Supabase.',
    liveTrafficMap: 'Live Traffic Map',
    currentOperations: 'Current Operations',
    trafficOverview: 'Traffic Flow Overview',
    affectedCorridor: 'Most Affected Corridor',
    mainIncident: 'Main Incident',
    systemHealth: 'System Health',
    route: 'Route I-95',
    heavyTraffic: 'Heavy delays due to lane closure and heavy traffic.',
    northHub: 'Accident at North Hub',
    responseTeam: 'Response team deployed. Estimated cleanup in 45 min.',
    stable: 'Stable',
    allSystems: 'All monitoring systems are functioning normally.',
    saving: 'Saving...',
    noDetails: 'No additional details provided.',
    retry: 'Retrying...',
    
    // Settings
    settings: 'Settings',
    personalizeExperience: 'Personalize your experience',
    theme: 'Theme',
    light: 'Light',
    lightTheme: 'Light Mode',
    dark: 'Dark',
    darkTheme: 'Dark Mode',
    language: 'Language',
    albanian: 'Albanian',
    english: 'English',
    notifications: 'Notifications',
    enable: 'Enable',
    disable: 'Disable',
    autoSave: 'Auto-Save',
    
    // Incident types
    accident: 'Accident',
    construction: 'Construction',
    heavyTraffic: 'Heavy Traffic',
    weather: 'Weather',
    
    // Severity
    minor: 'Minor',
    moderate: 'Moderate',
    major: 'Major',
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'albanian');

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || translations['albanian']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
