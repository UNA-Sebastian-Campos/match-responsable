export function formatColones(amount) {
  const num = Number(amount) || 0;
  return '₡' + num.toLocaleString('es-CR');
}

/**
 * Evalúa y puntúa una lista de mascotas obtenidas desde Supabase
 * según los 3 criterios solicitados:
 * 1. Presupuesto del usuario vs `costo_mensual_estimado`
 * 2. Horas disponibles vs `horas_minimas_atencion`
 * 3. Si vive en apartamento vs `apto_apartamento`
 * (y afinidad adicional por tamaño elegido)
 *
 * Retorna las mascotas ordenadas por mayor compatibilidad.
 */
export function evaluatePetsMatch(pets, formValues) {
  const userBudget = Number(formValues.presupuesto) || 0;
  const userHours = Number(formValues.tiempo) || 0;
  const livesInApartment = formValues.vivienda === 'Apartamento';
  const preferredSize = formValues.tamano;

  const evaluated = (pets || []).map((pet) => {
    const petCost = Number(pet.costo_mensual_estimado) || 0;
    const petHours = Number(pet.horas_minimas_atencion) || 0;
    const petAptoApt = Boolean(pet.apto_apartamento);

    const budgetOk = userBudget >= petCost;
    const hoursOk = userHours >= petHours;
    const housingOk = livesInApartment ? petAptoApt : true;
    const sizeMatch = preferredSize ? pet.tamano === preferredSize : true;

    let score = 0;
    if (budgetOk) score += 35;
    if (hoursOk) score += 35;
    if (housingOk) score += 20;
    if (sizeMatch) score += 10;

    const checks = [
      {
        key: 'presupuesto',
        ok: budgetOk,
        statusTag: budgetOk ? '[Compatible]' : '[Atención: requiere ajuste]',
        label: budgetOk
          ? `Presupuesto cubre su costo (${formatColones(petCost)}/mes)`
          : `Requiere ${formatColones(petCost)}/mes (tu presupuesto: ${formatColones(userBudget)})`,
      },
      {
        key: 'horas',
        ok: hoursOk,
        statusTag: hoursOk ? '[Compatible]' : '[Atención: requiere ajuste]',
        label: hoursOk
          ? `Tus ${userHours} h/día cubren sus ${petHours} h/día mínimas`
          : `Requiere mínimo ${petHours} h/día (disponés de ${userHours} h/día)`,
      },
      {
        key: 'vivienda',
        ok: housingOk,
        statusTag: housingOk ? '[Compatible]' : '[Atención: requiere ajuste]',
        label: housingOk
          ? livesInApartment
            ? 'Apto para vivir en apartamento'
            : `Compatible con tu vivienda (${formValues.vivienda})`
          : 'No recomendado para apartamento (requiere patio o mayor espacio)',
      },
    ];

    const isFullyCompatible = budgetOk && hoursOk && housingOk;

    return {
      ...pet,
      score,
      isFullyCompatible,
      overallStatusTag: isFullyCompatible
        ? '[Compatible]'
        : '[Atención: requiere ajuste]',
      sizeMatch,
      checks,
    };
  });

  return evaluated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Number(a.costo_mensual_estimado) - Number(b.costo_mensual_estimado);
  });
}

/**
 * Evalúa la aptitud general del adoptante (Condiciones del Hogar)
 * independiente de si hay o no mascotas en la base de datos.
 *
 * Utiliza los costos dinámicos reales de las mascotas de Supabase
 * cuando existan para evitar contradicciones entre las mascotas registradas y el diagnóstico.
 */
export function evaluateAdopterAptitude(formValues, pets = []) {
  const { mascota, tamano, vivienda, presupuesto, tiempo } = formValues;
  const numTiempo = Number(tiempo) || 0;
  const numPresupuesto = Number(presupuesto) || 0;
  const livesInApartment = vivienda === 'Apartamento';

  let viviendaOk = true;
  let viviendaTitle = 'Vivienda: compatible con la mascota seleccionada';
  let viviendaDesc = 'Tu tipo de vivienda es adecuado para el tamaño y tipo seleccionado.';

  if (vivienda === 'Casa con patio') {
    viviendaOk = true;
    viviendaDesc = 'Una casa con patio ofrece el espacio exterior ideal para cualquier tamaño de mascota.';
  } else if (vivienda === 'Casa sin patio') {
    viviendaOk = true;
    if (tamano === 'Grande' && mascota === 'Perro') {
      viviendaDesc = 'Una casa sin patio es habitable para un perro grande programando paseos regulares.';
    } else {
      viviendaDesc = 'El espacio interior es adecuado para el tipo de mascota elegido.';
    }
  } else if (livesInApartment) {
    if (mascota === 'Perro' && tamano === 'Grande') {
      viviendaOk = false;
      viviendaTitle = 'Vivienda: revisá la compatibilidad de espacio';
      viviendaDesc = 'Un apartamento puede resultar muy reducido para un perro grande debido a su necesidad de movilidad.';
    } else {
      viviendaOk = true;
      viviendaDesc = 'Un apartamento es adecuado para gatos y perros pequeños o medianos adaptables.';
    }
  }

  let tiempoOk = true;
  let tiempoTitle = 'Tiempo: tu disponibilidad cubre lo necesario';
  let tiempoDesc = `Las ${numTiempo} horas/día declaradas alcanzan para los cuidados diarios.`;

  if (mascota === 'Perro') {
    if (numTiempo < 1) {
      tiempoOk = false;
      tiempoTitle = 'Tiempo: tu disponibilidad es reducida';
      tiempoDesc = `Declaraste ${numTiempo} h/día; un perro suele requerir al menos 1 a 2 horas diarias de paseos y atención activa.`;
    } else {
      tiempoOk = true;
      tiempoDesc = `Tus ${numTiempo} h/día son adecuadas para paseos y cuidados activos de un perro.`;
    }
  } else if (mascota === 'Gato') {
    if (numTiempo < 0.5) {
      tiempoOk = false;
      tiempoTitle = 'Tiempo: tu disponibilidad es reducida';
      tiempoDesc = `Declaraste ${numTiempo} h/día; un gato requiere al menos 30 a 60 minutos diarios de interacción y cuidados.`;
    } else {
      tiempoOk = true;
      tiempoDesc = `Tus ${numTiempo} h/día son suficientes para la rutina y juegos diarios de un gato.`;
    }
  } else {
    tiempoOk = numTiempo >= 0.5;
    tiempoDesc = tiempoOk
      ? `Las ${numTiempo} horas/día declaradas son suficientes.`
      : `Se recomienda disponer de al menos 30 minutos a 1 hora diaria.`;
  }

  const activePets = pets || [];
  let referenceCost = 0;
  let referenceSalud = 0;

  if (activePets.length > 0) {
    const costsInDb = activePets
      .map((p) => Number(p.costo_mensual_estimado) || 0)
      .filter((c) => c > 0);

    if (costsInDb.length > 0) {
      const minCost = Math.min(...costsInDb);
      const avgCost = Math.round(
        costsInDb.reduce((a, b) => a + b, 0) / costsInDb.length
      );

      if (numPresupuesto >= minCost) {
        referenceCost = Math.min(numPresupuesto, avgCost);
      } else {
        referenceCost = minCost;
      }
    }
  }

  if (!referenceCost) {
    if (tamano === 'Pequeño') referenceCost = 20000;
    else if (tamano === 'Grande') referenceCost = 50000;
    else referenceCost = 35000;
  }

  referenceSalud = Math.round(referenceCost * 1.5);

  let costoOk = numPresupuesto >= referenceCost;
  let costoTitle = costoOk
    ? 'Costo: tu presupuesto cubre la manutención estimada'
    : 'Costo: el estimado mensual supera tu presupuesto';
  let costoDesc = costoOk
    ? `Tu presupuesto de ${formatColones(numPresupuesto)} cubre la manutención mensual estimada (${formatColones(referenceCost)}/mes).`
    : `Declaraste ${formatColones(numPresupuesto)} y la manutención estimada ronda ${formatColones(referenceCost)}/mes.`;

  const indicators = [
    {
      id: 'vivienda',
      ok: viviendaOk,
      statusTag: viviendaOk ? '[Compatible]' : '[Atención: requiere ajuste]',
      title: viviendaTitle,
      desc: viviendaDesc,
    },
    {
      id: 'tiempo',
      ok: tiempoOk,
      statusTag: tiempoOk ? '[Compatible]' : '[Atención: requiere ajuste]',
      title: tiempoTitle,
      desc: tiempoDesc,
    },
    {
      id: 'costo',
      ok: costoOk,
      statusTag: costoOk ? '[Compatible]' : '[Atención: requiere ajuste]',
      title: costoTitle,
      desc: costoDesc,
    },
  ];

  const isApto = viviendaOk && tiempoOk && costoOk;

  return {
    isApto,
    indicators,
    referenceCost,
    referenceSalud,
    statusTag: isApto ? '[Apto para adoptar]' : '[Requiere ajustes]',
  };
}

/**
 * Determina el escenario resultante entre los 4 posibles:
 * 1: Apto + Con Match de mascotas
 * 2: Apto + Sin Match en adopción (pero apto para adoptar)
 * 3: Requiere ajustes + Con opciones parciales
 * 4: Requiere ajustes + Sin match
 */
export function getScenario({ isApto, exactMatchesCount, totalPetsCount }) {
  if (isApto && exactMatchesCount > 0) return 1;
  if (isApto && exactMatchesCount === 0) return 2;
  if (!isApto && totalPetsCount > 0) return 3;
  return 4;
}
