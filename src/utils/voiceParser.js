
export const VP = {
  step1: {
    ask: '¿Qué mascota te interesa y de qué tamaño?',
    ex: 'Por ejemplo: “un perro mediano” o “una gata pequeña”.',
  },
  step2: {
    ask: 'Contame dónde vivís, cuánto podés gastar al mes y cuántas horas al día tenés para la mascota.',
    short: '¿Dónde vivís, cuánto podés gastar al mes y cuántas horas tenés?',
    ex: 'Por ejemplo: “vivo en apartamento, tengo 40 mil colones y 2 horas al día”.',
  },
  step3: {
    ask: '¿Has tenido mascotas antes? Si querés, decime también qué te genera más duda.',
    short: '¿Has tenido mascotas antes?',
    ex: 'Por ejemplo: “no, nunca he tenido; me preocupan los costos”.',
  },
};

export const SLOT_ASK = {
  mascota: '¿qué mascota te interesa: perro, gato u otra?',
  tamano: '¿de qué tamaño: pequeño, mediano o grande?',
  vivienda: '¿dónde vivís: apartamento, casa con patio o casa sin patio?',
  presupuesto: '¿cuánto podés gastar al mes, en colones?',
  tiempo: '¿cuántas horas al día podés dedicarle?',
  experiencia: '¿has tenido mascotas antes, sí o no?',
};

const NUM = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veintiun: 21, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
  veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};

const TENS = new Set(['treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']);

function isNumTok(w) {
  return /^\d+(\.\d+)?$/.test(w) || w in NUM || w === 'mil';
}

export function wordsToNumbers(t) {
  const toks = t.split(' ');
  const out = [];
  let i = 0;
  while (i < toks.length) {
    if (!isNumTok(toks[i])) {
      out.push(toks[i]);
      i++;
      continue;
    }
    let total = 0;
    let cur = 0;
    let j = i;
    while (j < toks.length) {
      const w = toks[j];
      if (/^\d+(\.\d+)?$/.test(w)) {
        cur += parseFloat(w);
        j++;
        continue;
      }
      if (w in NUM) {
        cur += NUM[w];
        j++;
        continue;
      }
      if (w === 'mil') {
        total += (cur || 1) * 1000;
        cur = 0;
        j++;
        continue;
      }
      if (w === 'millon' || w === 'millones') {
        total += (total + (cur || 1)) * 1e6;
        cur = 0;
        j++;
        continue;
      }
      if (w === 'y' && TENS.has(toks[j - 1]) && toks[j + 1] in NUM) {
        j++;
        continue;
      }
      break;
    }
    out.push(String(total + cur));
    i = j;
  }
  return out.join(' ');
}

export function normalize(text) {
  if (!text) return '';
  let t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/₡/g, ' ');
  t = t.replace(/(\d)[.,](?=\d{3}\b)/g, '$1');
  t = t.replace(/(\d),(\d)/g, '$1.$2');
  t = t.replace(/[¿?¡!;:"“”()]/g, ' ').replace(/[.,](?!\d)/g, ' ');
  t = t.replace(/\by (pico|algo|resto)\b/g, ' ');
  return wordsToNumbers(t.replace(/\s+/g, ' ').trim());
}

export function parseUtterance(raw, step, pending) {
  const t = normalize(raw);
  const s = {};

  if (step === 'step1') {
    if (/\b(perr[oa]s?|perrit[oa]s?|cachorr[oa]s?|can)\b/.test(t)) s.mascota = 'Perro';
    else if (/\b(gat[oa]s?|gatit[oa]s?|michis?|minin[oa])\b/.test(t)) s.mascota = 'Gato';
    else if (/\b(otr[oa]|conej[oa]|hamster|ave|pajar[oa]|tortuga|pez|no se|no lo se)\b/.test(t)) s.mascota = 'Otro';

    if (/\b(pequen[oa]s?|pequenit[oa]s?|chiquit[oa]s?|chic[oa]s?|mini)\b/.test(t)) s.tamano = 'Pequeño';
    else if (/\b(median[oa]s?)\b/.test(t)) s.tamano = 'Mediano';
    else if (/\b(grandes?|grandot[ea]|enorme)\b/.test(t)) s.tamano = 'Grande';
  }

  if (step === 'step2') {
    if (pending === 'patio') {
      if (/\b(no|sin)\b/.test(t)) s.vivienda = 'Casa sin patio';
      else if (/\b(si|con|tiene|claro)\b/.test(t)) s.vivienda = 'Casa con patio';
    }

    if (/sin (patio|jardin|zacate)/.test(t)) s.vivienda = 'Casa sin patio';
    else if (/\b(patio|jardin|zacate)\b/.test(t)) s.vivienda = 'Casa con patio';
    else if (/\b(apartamento|apto|departamento|condominio|cuarto|habitacion)\b/.test(t)) s.vivienda = 'Apartamento';
    else if (/\bcasa\b/.test(t) && !s.vivienda) s.viviendaAmbigua = true;

    let rest = t;
    const m = rest.match(/(\d+(?:\.\d+)?)\s*(?:horas?|hrs?|h)\b(\s*y\s*media)?/);
    if (m) {
      s.tiempo = parseFloat(m[1]) + (m[2] ? 0.5 : 0);
      rest = rest.replace(m[0], ' ');
    } else if (/\bmedia hora\b/.test(rest)) {
      s.tiempo = 0.5;
      rest = rest.replace(/\bmedia hora\b/, ' ');
    }

    const nums = [...rest.matchAll(/(\d+(?:\.\d+)?)(\s*colones)?/g)].map((x) => ({
      v: parseFloat(x[1]),
      col: !!x[2],
    }));

    const money = nums.filter((n) => n.col || n.v >= 500);
    if (money.length) {
      s.presupuesto = Math.max(...money.map((n) => n.v));
    } else if (/\b(nada|nadita)\b/.test(rest) && pending === 'presupuesto') {
      s.presupuesto = 0;
    }

    const bare = nums.filter((n) => !(n.col || n.v >= 500));
    if (bare.length && s.tiempo === undefined && pending === 'tiempo' && bare[0].v <= 24) {
      s.tiempo = bare[0].v;
    } else if (bare.length && s.presupuesto === undefined && pending === 'presupuesto') {
      s.presupuesto = bare[0].v;
    }
  }

  if (step === 'step3') {
    if (/\b(nunca|primera vez|no he tenido|no tengo experiencia|ninguna)\b/.test(t)) s.experiencia = 'No';
    else if (/\b(si|he tenido|tuve|tengo experiencia|claro|varias)\b/.test(t)) s.experiencia = 'Sí';
    else if (/^no\b|\bno\b/.test(t)) s.experiencia = 'No';

    const dudas = [];
    if (/cost|plata|dinero|gasto|precio|caro/.test(t)) dudas.push('Costos');
    if (/salud|cuidad|veterin|vacun|enferm/.test(t)) dudas.push('Cuidados / salud');
    if (/tiempo|compromiso|horario|viaj/.test(t)) dudas.push('Tiempo / compromiso');
    if (/requisit|refugio|papeles|tramite/.test(t)) dudas.push('Requisitos del refugio o persona responsable');
    if (dudas.length) s.dudas = dudas;
  }

  return s;
}

export function parseYesNo(raw) {
  const t = normalize(raw);
  if (/\b(no|corregir|cambiar|incorrecto|mal|equivocad[oa]|espera|esperate|cancelar|modificar)\b/.test(t)) return 'no';
  if (/\b(si|sip|sep|claro|correcto|exacto|dale|continuar|continua|siguiente|listo|ok|okay|eso|perfecto|de acuerdo|adelante|bien|esta bien|simon|aja)\b/.test(t)) return 'yes';
  return null;
}

