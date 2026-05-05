import { supabase } from './supabaseClient';

const TABLE_DEFINITIONS = [
  { name: 'user_data', schema: 'standard' },
  { name: 'raportet', schema: 'legacy' },
  { name: 'Raportet', schema: 'legacy' },
];

const STATUS_ALIASES = {
  active: 'active',
  aktiv: 'active',
  under_control: 'under_control',
  'under control': 'under_control',
  'nën kontroll': 'under_control',
  'nen kontroll': 'under_control',
  cleared: 'cleared',
  pastruar: 'cleared',
};

const TYPE_ALIASES = {
  accident: 'accident',
  aksident: 'accident',
  construction: 'construction',
  konstruksion: 'construction',
  'road work': 'construction',
  'punime në rrugë': 'construction',
  'punime ne rruge': 'construction',
  weather: 'weather',
  mot: 'weather',
  'heavy traffic': 'heavyTrafficType',
  'trafik i rëndë': 'heavyTrafficType',
  'trafik i rende': 'heavyTrafficType',
};

const SEVERITY_ALIASES = {
  minor: 'minor',
  minore: 'minor',
  'e ulët': 'minor',
  'e ulet': 'minor',
  moderate: 'moderate',
  mesatare: 'moderate',
  major: 'major',
  madhore: 'major',
  'e lartë': 'major',
  'e larte': 'major',
};

const isMissingTableOrColumn = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    error?.code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('column') ||
    message.includes('relation')
  );
};

const normalizeKey = (value) => `${value || ''}`.trim().toLowerCase();
const normalizeStatus = (value) => STATUS_ALIASES[normalizeKey(value)] || 'active';
const normalizeType = (value) => TYPE_ALIASES[normalizeKey(value)] || 'accident';
const normalizeSeverity = (value) => SEVERITY_ALIASES[normalizeKey(value)] || 'minor';

const parseCoordinate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapStandardRow = (row, table) => ({
  id: row.id,
  title: row.title || row['Titulli i incidentit'] || '',
  description: row.description || row['Përshkrimi'] || '',
  type: normalizeType(row.type || row.Kategoria),
  severity: normalizeSeverity(row.severity || row.Rëndësia),
  status: normalizeStatus(row.status || row.Statusi),
  location: {
    lat: parseCoordinate(row.latitude ?? row.Latitude ?? row.lat),
    lng: parseCoordinate(row.longitude ?? row.Longitude ?? row.lng),
  },
  createdAt: row.created_at || row.updated_at || new Date().toISOString(),
  sourceTable: table.name,
  sourceSchema: table.schema,
});

const mapLegacyRow = (row, table) => ({
  id: row.id,
  title: row['Titulli i incidentit'] || row.title || '',
  description: row['Përshkrimi'] || row.description || '',
  type: normalizeType(row.Kategoria || row.type),
  severity: normalizeSeverity(row.Rëndësia || row.severity),
  status: normalizeStatus(row.Statusi || row.status),
  location: {
    lat: parseCoordinate(row.Latitude ?? row.latitude ?? row.lat),
    lng: parseCoordinate(row.Longitude ?? row.longitude ?? row.lng),
  },
  createdAt: row.created_at || row.updated_at || new Date().toISOString(),
  sourceTable: table.name,
  sourceSchema: table.schema,
});

const mapRow = (row, table) => (table.schema === 'standard' ? mapStandardRow(row, table) : mapLegacyRow(row, table));

const buildStandardPayloads = (report, userId) => {
  const base = {
    title: report.title,
    description: report.description || null,
    type: report.type,
    severity: report.severity,
    status: report.status,
    user_id: userId,
  };

  return [
    {
      ...base,
      latitude: report.location?.lat ?? null,
      longitude: report.location?.lng ?? null,
    },
    base,
  ];
};

const buildLegacyPayloads = (report, userId) => {
  const base = {
    'Titulli i incidentit': report.title,
    'Përshkrimi': report.description || null,
    Kategoria: report.type,
    Rëndësia: report.severity,
    Statusi: report.status,
  };

  return [
    {
      ...base,
      user_id: userId,
      Latitude: report.location?.lat ?? null,
      Longitude: report.location?.lng ?? null,
    },
    {
      ...base,
      user_id: userId,
    },
    {
      ...base,
      Latitude: report.location?.lat ?? null,
      Longitude: report.location?.lng ?? null,
    },
    base,
  ];
};

const buildFetchCandidates = (table, userId) => (
  table.schema === 'standard'
    ? [
        () => supabase.from(table.name).select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        () => supabase.from(table.name).select('*').eq('user_id', userId),
      ]
    : [
        () => supabase.from(table.name).select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        () => supabase.from(table.name).select('*').eq('user_id', userId),
        () => supabase.from(table.name).select('*').order('created_at', { ascending: false }),
        () => supabase.from(table.name).select('*'),
      ]
);

const buildMutationPayloads = (table, report, userId) => (
  table.schema === 'standard' ? buildStandardPayloads(report, userId) : buildLegacyPayloads(report, userId)
);

const executeQueryCandidates = async (builders) => {
  let lastError = null;

  for (const buildQuery of builders) {
    const result = await buildQuery();
    if (!result.error) {
      return result;
    }

    lastError = result.error;
    if (!isMissingTableOrColumn(result.error)) {
      throw result.error;
    }
  }

  throw lastError;
};

const tryWithTables = async (handler) => {
  let lastError = null;

  for (const table of TABLE_DEFINITIONS) {
    try {
      return await handler(table);
    } catch (error) {
      lastError = error;
      if (!isMissingTableOrColumn(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error('No compatible reports table found.');
};

const buildOptimisticResult = (table, report, reportId = null) => ({
  id: reportId,
  title: report.title,
  description: report.description || '',
  type: report.type,
  severity: report.severity,
  status: report.status,
  location: {
    lat: report.location?.lat ?? null,
    lng: report.location?.lng ?? null,
  },
  createdAt: new Date().toISOString(),
  sourceTable: table.name,
  sourceSchema: table.schema,
});

export const fetchIncidentReports = async (userId) =>
  tryWithTables(async (table) => {
    const { data } = await executeQueryCandidates(buildFetchCandidates(table, userId));
    return (data || []).map((row) => mapRow(row, table));
  });

export const createIncidentReport = async (userId, report) =>
  tryWithTables(async (table) => {
    const payloads = buildMutationPayloads(table, report, userId);
    const builders = payloads.flatMap((payload) => [
      () => supabase.from(table.name).insert([payload]).select().single(),
      () => supabase.from(table.name).insert([payload]),
    ]);
    const { data } = await executeQueryCandidates(builders);
    return data ? mapRow(data, table) : buildOptimisticResult(table, report);
  });

export const updateIncidentReport = async (userId, reportId, report, sourceTable) => {
  const targetTables = sourceTable
    ? TABLE_DEFINITIONS.filter((table) => table.name === sourceTable)
    : TABLE_DEFINITIONS;

  return tryWithTables(async (table) => {
    if (targetTables.length && !targetTables.some((item) => item.name === table.name)) {
      throw { code: 'PGRST205', message: 'Skip incompatible table' };
    }

    const payloads = buildMutationPayloads(table, report, userId);
    const builders = payloads.flatMap((payload) => [
      () => supabase.from(table.name).update(payload).eq('id', reportId).eq('user_id', userId).select().single(),
      () => supabase.from(table.name).update(payload).eq('id', reportId).eq('user_id', userId),
      () => supabase.from(table.name).update(payload).eq('id', reportId).select().single(),
      () => supabase.from(table.name).update(payload).eq('id', reportId),
    ]);

    const { data } = await executeQueryCandidates(builders);
    return data ? mapRow(data, table) : buildOptimisticResult(table, report, reportId);
  });
};

export const removeIncidentReport = async (userId, reportId, sourceTable) => {
  const targetTables = sourceTable
    ? TABLE_DEFINITIONS.filter((table) => table.name === sourceTable)
    : TABLE_DEFINITIONS;

  return tryWithTables(async (table) => {
    if (targetTables.length && !targetTables.some((item) => item.name === table.name)) {
      throw { code: 'PGRST205', message: 'Skip incompatible table' };
    }

    const builders = [
      () => supabase.from(table.name).delete().eq('id', reportId).eq('user_id', userId),
      () => supabase.from(table.name).delete().eq('id', reportId),
    ];

    await executeQueryCandidates(builders);
    return true;
  });
};
