import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import {
  formatColones,
  evaluatePetsMatch,
  evaluateAdopterAptitude,
  getScenario,
} from '../utils/matchLogic';
import { VP, SLOT_ASK, parseUtterance, parseYesNo } from '../utils/voiceParser';
import VoiceAssistantPanel, { VoiceConsentModal } from './VoiceAssistantPanel';
import {
  FiMic,
  FiMicOff,
  FiArrowRight,
  FiArrowLeft,
  FiCheck,
  FiAlertCircle,
  FiCheckCircle,
  FiVolume2,
  FiMapPin,
  FiPhone,
  FiMail,
  FiExternalLink,
  FiClock,
  FiDownload,
  FiX,
  FiInfo,
} from 'react-icons/fi';
import {
  FaHouse,
  FaStethoscope,
  FaBookOpen,
} from 'react-icons/fa6';

export default function PublicWizard({
  screen,
  navigateTo,
  goBack,
  canGoBack,
  resetHistoryToWelcome,
}) {
  const [matchedPets, setMatchedPets] = useState([]);
  const [detalleKey, setDetalleKey] = useState('albergues');
  const [selectedResource, setSelectedResource] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [expandedImage, setExpandedImage] = useState(null);
  const [contactModalPet, setContactModalPet] = useState(null);

  const [publicRefugios, setPublicRefugios] = useState([]);
  const [publicVeterinarios, setPublicVeterinarios] = useState([]);
  const [publicGuias, setPublicGuias] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  async function loadPublicResources() {
    setLoadingResources(true);
    try {
      const [refRes, vetRes, guiaRes] = await Promise.all([
        supabase.from('refugios').select('*').eq('estado', 'activo').order('created_at', { ascending: false }),
        supabase.from('veterinarios').select('*').eq('estado', 'activo').order('created_at', { ascending: false }),
        supabase.from('guias').select('*').eq('estado', 'activo').order('created_at', { ascending: false }),
      ]);
      if (!refRes.error && refRes.data) setPublicRefugios(refRes.data);
      if (!vetRes.error && vetRes.data) setPublicVeterinarios(vetRes.data);
      if (!guiaRes.error && guiaRes.data) setPublicGuias(guiaRes.data);
    } catch (err) {
      console.error('Error al cargar recursos públicos:', err);
    } finally {
      setLoadingResources(false);
    }
  }

  useEffect(() => {
    loadPublicResources();
  }, []);

  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceConsented, setVoiceConsented] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voicePhase, setVoicePhase] = useState('idle');
  const [voiceKind, setVoiceKind] = useState('ok');
  const [voiceMsg, setVoiceMsg] = useState('');
  const [voiceHeard, setVoiceHeard] = useState('');
  const [voicePending, setVoicePending] = useState(null);
  const [voiceSim, setVoiceSim] = useState(false);
  const [voiceTts, setVoiceTts] = useState(true);
  const [noMatchCount, setNoMatchCount] = useState(0);

  const recRef = useRef(null);
  const keepListeningRef = useRef(false);
  const isAssistantSpeakingRef = useRef(false);
  const voicePhaseRef = useRef('idle');
  const voicePendingRef = useRef(null);
  const screenRef = useRef(screen);
  const voiceOnRef = useRef(false);
  const handleUtteranceRef = useRef(null);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    voiceOnRef.current = voiceOn;
  }, [voiceOn]);

  function updateVoicePhase(val) {
    voicePhaseRef.current = val;
    setVoicePhase(val);
  }

  function updateVoicePending(val) {
    voicePendingRef.current = val;
    setVoicePending(val);
  }

  const isBrowserSRSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const {
    register,
    setValue,
    getValues,
    watch,
    trigger,
    reset,
    formState: { errors },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      mascota: '',
      tamano: '',
      vivienda: '',
      presupuesto: '',
      tiempo: '',
      experiencia: '',
      dudas: [],
    },
  });

  const values = watch();
  const { mascota, tamano, vivienda, presupuesto, tiempo, experiencia, dudas } = values;

  function say(text, onComplete) {
    if (!voiceTts || typeof window === 'undefined' || !window.speechSynthesis) {
      if (onComplete) onComplete();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const v = voices.find((x) => /^es/i.test(x.lang));
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'es-CR';
      u.rate = 1.05;

      isAssistantSpeakingRef.current = true;
      if (recRef.current) {
        try {
          recRef.current.abort();
        } catch (_e) {}
      }

      let speechFinished = false;
      const maxDurationMs = Math.max(3000, text.length * 100);

      const handleSpeechDone = () => {
        if (speechFinished) return;
        speechFinished = true;
        isAssistantSpeakingRef.current = false;
        if (onComplete) onComplete();
        if (keepListeningRef.current && voiceOn) {
          setTimeout(() => {
            if (keepListeningRef.current && !isAssistantSpeakingRef.current && voiceOn) {
              startListeningInternal();
            }
          }, 150);
        }
      };

      u.onend = handleSpeechDone;
      u.onerror = handleSpeechDone;
      setTimeout(handleSpeechDone, maxDurationMs);

      window.speechSynthesis.speak(u);
    } catch (_e) {
      isAssistantSpeakingRef.current = false;
      if (onComplete) onComplete();
    }
  }

  function setAssistantMsg(msg, kind = 'ok', speak = true) {
    setVoiceMsg(msg);
    setVoiceKind(kind);
    if (speak) {
      say(msg.replace(/[“”]/g, ''));
    }
  }

  function showToast(text) {
    setToastMsg(text);
    setTimeout(() => {
      setToastMsg('');
    }, 2800);
  }

  function renderLightbox() {
    if (!expandedImage) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animate-fade-in cursor-zoom-out"
        onClick={() => setExpandedImage(null)}
      >
        <button
          type="button"
          onClick={() => setExpandedImage(null)}
          className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition cursor-pointer"
          aria-label="Cerrar imagen ampliada"
        >
          <FiX className="w-6 h-6" />
        </button>
        <div
          className="relative max-w-5xl max-h-[92vh] flex flex-col items-center justify-center p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={expandedImage.url}
            alt={expandedImage.alt || 'Imagen ampliada'}
            className="max-w-[92vw] max-h-[82vh] w-auto h-auto object-contain rounded-2xl shadow-2xl border border-white/20"
          />
          {expandedImage.alt && (
            <p className="mt-3 text-white/90 text-xs sm:text-sm font-semibold bg-black/60 px-4 py-1.5 rounded-full backdrop-blur-md text-center max-w-xl truncate">
              {expandedImage.alt}
            </p>
          )}
        </div>
      </div>
    );
  }

  function renderContactModal() {
    if (!contactModalPet) return null;
    const pet = contactModalPet;
    const u = pet.usuarios;
    const shelterName = u?.nombre_refugio || 'Refugio / Tutor responsable';
    const address = u?.direccion;
    const phone = u?.telefono;
    const email = u?.correo_contacto || u?.email;
    const social = u?.redes_sociales;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
        onClick={() => setContactModalPet(null)}
      >
        <div
          className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-brand-line flex flex-col gap-4 relative animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Botón X de cerrar en gris */}
          <button
            type="button"
            onClick={() => setContactModalPet(null)}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition cursor-pointer border border-gray-200"
            title="Cerrar ventana"
            aria-label="Cerrar ventana"
          >
            <FiX className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-accent uppercase tracking-wide mb-1">
              <FaHouse className="w-3.5 h-3.5" />
              <span>Contacto para Adopción</span>
            </div>
            <h3 id="contact-modal-title" className="text-base sm:text-lg font-bold text-brand-ink">
              {shelterName}
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Coordinación de adopción para <strong>{pet.nombre}</strong> ({pet.tipo} · {pet.tamano}):
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            {address && (
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-gray-50 border border-gray-200/80 text-gray-700">
                <FiMapPin className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Ubicación</span>
                  <span className="text-xs font-medium leading-snug">{address}</span>
                </div>
              </div>
            )}

            {phone && (
              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200 text-emerald-800 font-semibold transition group"
                title="Llamar o contactar por WhatsApp"
              >
                <div className="flex items-center gap-2">
                  <FiPhone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{phone}</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 group-hover:underline">Llamar / WhatsApp &rarr;</span>
              </a>
            )}

            {email && (
              <a
                href={`mailto:${email}?subject=Interés de adopción por ${encodeURIComponent(pet.nombre)}`}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100/90 border border-blue-200 text-blue-800 font-semibold transition group"
                title="Enviar correo electrónico"
              >
                <div className="flex items-center gap-2 truncate">
                  <FiMail className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
                <span className="text-[11px] font-bold text-blue-700 group-hover:underline shrink-0">Correo &rarr;</span>
              </a>
            )}

            {social && (
              <a
                href={social.startsWith('http') ? social : `https://${social}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100/90 border border-purple-200 text-purple-800 font-semibold transition group"
                title="Abrir enlace"
              >
                <div className="flex items-center gap-2 truncate">
                  <FiExternalLink className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="truncate">{social}</span>
                </div>
                <span className="text-[11px] font-bold text-purple-700 group-hover:underline shrink-0">Abrir &rarr;</span>
              </a>
            )}

            {!phone && !email && !social && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-500 text-xs">
                <p className="italic mb-2">No se especificaron datos directos de contacto para este registro.</p>
                <button
                  type="button"
                  onClick={() => {
                    setContactModalPet(null);
                    navigateTo('fuentes');
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-brand-accent text-white font-semibold text-xs hover:bg-brand-accent/95 transition cursor-pointer"
                >
                  Ver directorio de refugios aliados
                </button>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-brand-line/70 flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <FiInfo className="w-3.5 h-3.5 text-brand-accent shrink-0" />
              <span>Indica que viste a <strong>{pet.nombre}</strong> en Match Responsable.</span>
            </p>
            <button
              type="button"
              onClick={() => setContactModalPet(null)}
              className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs border border-gray-300 transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch (_e) {}
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    updateVoicePhase('idle');
    updateVoicePending(null);
    setVoiceHeard('');
    setNoMatchCount(0);

    if (voiceOn && VP[screen]) {
      const prompt = VP[screen].ask;
      setAssistantMsg(prompt, 'ok', voiceTts);
      setVoiceSim(!isBrowserSRSupported);

      if (keepListeningRef.current && isBrowserSRSupported && !voiceTts) {
        startListeningInternal();
      }
    } else {
      setVoiceListening(false);
    }
  }, [screen, voiceOn]);

  function startListeningInternal() {
    if (typeof window === 'undefined') return;
    if (!voiceOn) return;
    if (isAssistantSpeakingRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceSim(true);
      setAssistantMsg(
        'Este navegador no tiene reconocimiento de voz. Escribí tu respuesta abajo o tocá las opciones.',
        'warn',
        false
      );
      return;
    }

    try {
      if (recRef.current) {
        try {
          recRef.current.abort();
        } catch (_e) {}
      }
      const rec = new SR();
      rec.lang = 'es-CR';
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      rec.continuous = true;

      rec.onresult = (e) => {
        let interim = '';
        let finalAlt = null;

        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) {
            finalAlt = Array.from(r).map((a) => a.transcript.trim());
          } else {
            interim += r[0].transcript;
          }
        }

        if (interim) {
          setVoiceHeard(interim);
        }

        if (finalAlt && finalAlt.length > 0) {
          setVoiceHeard(finalAlt[0]);
          if (handleUtteranceRef.current) {
            handleUtteranceRef.current(finalAlt);
          } else {
            handleUtterance(finalAlt);
          }
        }
      };

      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') {
          return;
        }
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          keepListeningRef.current = false;
          setVoiceListening(false);
          setVoiceSim(true);
          setAssistantMsg(
            'No hay permiso para usar el micrófono. Podés escribir tu respuesta abajo o tocar las opciones.',
            'warn',
            false
          );
          return;
        }
      };

      rec.onend = () => {
        if (keepListeningRef.current && !isAssistantSpeakingRef.current && voiceOn) {
          setTimeout(() => {
            if (keepListeningRef.current && !isAssistantSpeakingRef.current && voiceOn) {
              try {
                rec.start();
                setVoiceListening(true);
              } catch (_err) {
                startListeningInternal();
              }
            }
          }, 150);
        } else {
          setVoiceListening(false);
        }
      };

      rec.start();
      recRef.current = rec;
      setVoiceListening(true);
    } catch (_err) {
      setVoiceListening(false);
    }
  }

  function stopListening() {
    keepListeningRef.current = false;
    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch (_e) {}
    }
    setVoiceListening(false);
  }

  function handleMicToggle() {
    if (voiceListening || keepListeningRef.current) {
      stopListening();
    } else {
      keepListeningRef.current = true;
      startListeningInternal();
    }
  }

  function buildStepSummary(st) {
    const cur = getValues();
    if (st === 'step1') {
      const m = cur.mascota === 'Otro' ? 'otra mascota' : (cur.mascota || '').toLowerCase();
      const t = (cur.tamano || '').toLowerCase();
      return `${m}, tamaño ${t}`;
    }
    if (st === 'step2') {
      const v = (cur.vivienda || '').toLowerCase();
      const b = cur.presupuesto ? formatColones(cur.presupuesto) : '0 colones';
      const h = cur.tiempo || '0';
      return `${v}, ${b} al mes y ${h} ${h === '1' ? 'hora' : 'horas'} al día`;
    }
    if (st === 'step3') {
      const exp = cur.experiencia === 'Sí' ? 'ya tuviste mascotas' : 'sería tu primera mascota';
      const d = Array.isArray(cur.dudas) && cur.dudas.length
        ? `; te preocupa: ${cur.dudas.map((x) => x.toLowerCase()).join(', ')}`
        : '';
      return `${exp}${d}`;
    }
    return '';
  }

  function checkMissingSlots(st, currentParsed = {}) {
    const cur = { ...getValues(), ...currentParsed };
    if (st === 'step1') {
      const m = [];
      if (!cur.mascota) m.push('mascota');
      if (!cur.tamano) m.push('tamano');
      return m;
    }
    if (st === 'step2') {
      const m = [];
      if (!cur.vivienda) m.push('vivienda');
      if (cur.presupuesto === '' || cur.presupuesto === undefined || cur.presupuesto === null) {
        m.push('presupuesto');
      }
      if (cur.tiempo === '' || cur.tiempo === undefined || cur.tiempo === null) {
        m.push('tiempo');
      }
      return m;
    }
    if (st === 'step3') {
      return cur.experiencia ? [] : ['experiencia'];
    }
    return [];
  }

  function handleUtterance(alternatives) {
    const primaryHeard = alternatives[0] || '';
    setVoiceHeard(primaryHeard);
    const currentSc = screenRef.current;

    const yn = alternatives.map(parseYesNo).find(Boolean);
    const isConfirmPhase = voicePhaseRef.current === 'confirm';
    const allSlotsFilled = checkMissingSlots(currentSc).length === 0;

    if (isConfirmPhase || (yn === 'yes' && allSlotsFilled)) {
      if (yn === 'yes') {
        handleConfirmYes();
        return;
      }
      if (yn === 'no') {
        handleConfirmNo();
        return;
      }
      setAssistantMsg(
        'Decí “sí” para continuar o “corregir” para cambiar algo. También podés tocar los botones.',
        'warn'
      );
      return;
    }

    let slots = {};
    for (const alt of alternatives) {
      slots = parseUtterance(alt, currentSc, voicePendingRef.current);
      if (Object.keys(slots).length) break;
    }

    if (!Object.keys(slots).length) {
      const nextCount = noMatchCount + 1;
      setNoMatchCount(nextCount);
      const p = VP[currentSc];
      if (nextCount === 1) {
        setAssistantMsg(
          `Perdón, no te entendí. ${voicePendingRef.current ? 'Decime ' + SLOT_ASK[voicePendingRef.current] : (p ? p.ask : '')}`,
          'warn'
        );
      } else if (nextCount === 2) {
        setAssistantMsg(`Todavía no te entiendo. ${p ? p.ex : ''}`, 'warn');
      } else {
        setVoiceSim(true);
        setAssistantMsg(
          'No logro entenderte por voz. Podés escribir tu respuesta abajo o tocar las opciones en pantalla.',
          'warn'
        );
      }
      return;
    }

    setNoMatchCount(0);

    if (slots.mascota) setValue('mascota', slots.mascota, { shouldValidate: true, shouldDirty: true });
    if (slots.tamano) setValue('tamano', slots.tamano, { shouldValidate: true, shouldDirty: true });
    if (slots.vivienda) setValue('vivienda', slots.vivienda, { shouldValidate: true, shouldDirty: true });

    if (slots.presupuesto !== undefined) {
      if (slots.presupuesto > 0) {
        setValue('presupuesto', slots.presupuesto, { shouldValidate: true, shouldDirty: true });
      } else {
        setValue('presupuesto', '', { shouldValidate: true });
        setAssistantMsg('El presupuesto tiene que ser mayor a cero colones.', 'warn');
        updateVoicePending('presupuesto');
        return;
      }
    }

    if (slots.tiempo !== undefined) {
      if (slots.tiempo >= 0 && slots.tiempo <= 24) {
        setValue('tiempo', slots.tiempo, { shouldValidate: true, shouldDirty: true });
      } else {
        setValue('tiempo', '', { shouldValidate: true });
        setAssistantMsg('Las horas disponibles deben estar entre 0 y 24.', 'warn');
        updateVoicePending('tiempo');
        return;
      }
    }

    if (slots.experiencia) {
      setValue('experiencia', slots.experiencia, { shouldValidate: true, shouldDirty: true });
    }

    if (slots.dudas && slots.dudas.length) {
      const existing = getValues('dudas') || [];
      const merged = Array.from(new Set([...existing, ...slots.dudas]));
      setValue('dudas', merged, { shouldDirty: true });
    }

    if (slots.viviendaAmbigua && !getValues('vivienda')) {
      updateVoicePending('patio');
      setAssistantMsg('Anoté casa. ¿Tu casa tiene patio?', 'ok');
      return;
    }

    const missing = checkMissingSlots(currentSc, slots);
    if (missing.length > 0) {
      const nextPending = missing[0];
      updateVoicePending(nextPending);
      setAssistantMsg(`Anoté tus datos. Me falta saber ${SLOT_ASK[nextPending]}`, 'ok');
      return;
    }

    updateVoicePhase('confirm');
    updateVoicePending(null);
    const summary = buildStepSummary(currentSc);
    setAssistantMsg(`Entendí: ${summary}. ¿Es correcto?`);
  }

  handleUtteranceRef.current = handleUtterance;

  function handleConfirmYes() {
    updateVoicePhase('idle');
    setVoiceHeard('');
    const currentSc = screenRef.current;
    if (currentSc === 'step1') {
      handleStep1Continue();
    } else if (currentSc === 'step2') {
      handleStep2Continue();
    } else if (currentSc === 'step3') {
      handleStep3Submit();
    }
  }

  function handleConfirmNo() {
    updateVoicePhase('idle');
    setAssistantMsg('Está bien. Decilo de nuevo o tocá directamente la opción que querés cambiar.');
  }

  function handleOpenVoiceConsent() {
    if (voiceConsented) {
      setVoiceOn(true);
      keepListeningRef.current = true;
      navigateTo('step1');
    } else {
      setShowConsentModal(true);
    }
  }

  function handleAcceptConsent() {
    setVoiceConsented(true);
    setVoiceOn(true);
    keepListeningRef.current = true;
    setShowConsentModal(false);
    if (screen === 'welcome') {
      navigateTo('step1');
    }
  }

  function handleToggleVoice() {
    if (voiceOn) {
      setVoiceOn(false);
      stopListening();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } else {
      if (!voiceConsented) {
        setShowConsentModal(true);
      } else {
        setVoiceOn(true);
        keepListeningRef.current = true;
      }
    }
  }

  function handleSelectOption(fieldName, optionValue) {
    setValue(fieldName, optionValue, { shouldValidate: true, shouldDirty: true });
  }

  function handleToggleDuda(dudaValue) {
    const current = Array.isArray(dudas) ? dudas : [];
    const next = current.includes(dudaValue)
      ? current.filter((item) => item !== dudaValue)
      : [...current, dudaValue];
    setValue('dudas', next, { shouldDirty: true });
  }

  async function handleStep1Continue() {
    const curMascota = getValues('mascota');
    const curTamano = getValues('tamano');
    if (!curMascota || !curTamano) return;
    navigateTo('step2');
  }

  async function handleStep2Continue() {
    const valid = await trigger(['vivienda', 'presupuesto', 'tiempo']);
    if (!valid || !getValues('vivienda')) return;
    navigateTo('step3');
  }

  async function handleStep3Submit() {
    const valid = await trigger(['experiencia']);
    if (!valid || !getValues('experiencia')) return;

    navigateTo('loading', false);

    let rawPets = [];
    try {
      let query = supabase
        .from('mascotas')
        .select('*, usuarios(id, nombre_refugio, email, telefono, correo_contacto, redes_sociales, direccion)')
        .neq('estado', 'inactiva');
      const curMascota = getValues('mascota');
      if (curMascota && curMascota !== 'Otro') {
        query = query.eq('tipo', curMascota);
      }
      const { data, error } = await query;
      if (!error && data) {
        rawPets = data;
      }
    } catch (_err) {
      rawPets = [];
    }

    const currentFormValues = getValues();
    const evaluated = evaluatePetsMatch(rawPets, currentFormValues);

    setTimeout(() => {
      setMatchedPets(evaluated);
      navigateTo('result', true);
    }, 600);
  }

  function handleResetAll() {
    reset({
      mascota: '',
      tamano: '',
      vivienda: '',
      presupuesto: '',
      tiempo: '',
      experiencia: '',
      dudas: [],
    });
    setMatchedPets([]);
    setSelectedResource(null);
    setVoiceOn(false);
    stopListening();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    resetHistoryToWelcome();
  }

  function openDetalle(key) {
    setDetalleKey(key);
    setSelectedResource(null);
    navigateTo('detalle');
  }

  const adopterAptitude = evaluateAdopterAptitude(values, matchedPets);
  const exactMatches = matchedPets.filter((p) => p.isFullyCompatible);
  const partialMatches = matchedPets.filter((p) => !p.isFullyCompatible);
  const currentScenario = getScenario({
    isApto: adopterAptitude.isApto,
    exactMatchesCount: exactMatches.length,
    totalPetsCount: matchedPets.length,
  });

  function handleListenResultSummary() {
    const okCount = adopterAptitude.indicators.filter((i) => i.ok).length;
    const warnings = adopterAptitude.indicators
      .filter((i) => !i.ok)
      .map((i) => i.title.split(':')[0].toLowerCase());

    let text = adopterAptitude.isApto
      ? `Tu perfil es apto para adoptar. Cumplís con ${okCount} de los 3 aspectos analizados.`
      : `Tu preparación tiene puntos por considerar: ${okCount} de 3 aspectos están cubiertos.`;

    if (warnings.length) {
      text += ` Es importante revisar ${warnings.join(' y ')}.`;
    }
    text += ` La manutención mensual estimada ronda ${formatColones(adopterAptitude.referenceCost)}.`;

    if (exactMatches.length > 0) {
      text += ` Además, encontramos ${exactMatches.length} ${exactMatches.length === 1 ? 'mascota compatible' : 'mascotas compatibles'} disponibles para adopción.`;
    } else if (partialMatches.length > 0) {
      text += ` Hay mascotas con compatibilidad cercana disponibles para adopción.`;
    } else {
      text += ` En este momento no hay mascotas registradas que coincidan exactamente con tu búsqueda.`;
    }

    say(text);
    showToast('Leyendo un resumen de tu panorama…');
  }

  function getDetalleMeta(key) {
    if (key === 'albergues') {
      return {
        eyebrow: 'Directorio oficial',
        title: 'Refugios verificados',
        desc: 'Organizaciones y personas comprometidas con el rescate y la adopción responsable.',
      };
    }
    if (key === 'veterinarios') {
      return {
        eyebrow: 'Atención profesional',
        title: 'Veterinarios recomendados',
        desc: 'Clínicas veterinarias y especialistas de confianza para el cuidado médico preventivo y de urgencia.',
      };
    }
    return {
      eyebrow: 'Acompañamiento y bienestar',
      title: 'Guías de cuidado responsable',
      desc: 'Materiales descargables y recomendaciones prácticas elaboradas por especialistas.',
    };
  }

  const voiceToggleChip = (
    <button
      type="button"
      onClick={handleToggleVoice}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 border transition cursor-pointer mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
        voiceOn
          ? 'bg-brand-accent text-white border-brand-accent shadow-sm'
          : 'bg-brand-accent-tint text-brand-accent border-brand-accent/30 hover:border-brand-accent'
      }`}
    >
      {voiceOn ? (
        <FiMicOff className="w-3.5 h-3.5 flex-shrink-0" />
      ) : (
        <FiMic className="w-3.5 h-3.5 flex-shrink-0" />
      )}
      <span>{voiceOn ? 'Responder solo tocando' : 'Responder por voz'}</span>
    </button>
  );

  const voiceStateProp = {
    on: voiceOn,
    listening: voiceListening,
    phase: voicePhase,
    kind: voiceKind,
    msg: voiceMsg,
    heard: voiceHeard,
    sim: voiceSim,
    tts: voiceTts,
    supported: isBrowserSRSupported,
  };

  /* -------------------------------------------------------------------------- */
  /* PANTALLA: BIENVENIDA (HERO RESPONSIVE DESKTOP + MOBILE)                    */
  /* -------------------------------------------------------------------------- */
  if (screen === 'welcome') {
    return (
      <>
        <VoiceConsentModal
          isOpen={showConsentModal}
          onAccept={handleAcceptConsent}
          onClose={() => setShowConsentModal(false)}
        />

        <section className="bg-brand-surface border border-brand-line rounded-2xl p-5 sm:p-7 lg:p-8 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            <div className="lg:col-span-7 flex flex-col items-start">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 bg-brand-accent-tint border border-brand-accent/25 rounded-full px-3 py-1 mb-3">
                <span className="w-2 h-2 rounded-full bg-brand-accent" aria-hidden="true" />
                Evaluación rápida de 3 minutos
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-bold leading-tight text-brand-ink mb-2.5">
                ¿Estoy listo o lista para adoptar una mascota?
              </h1>

              {/* Auditoría #1: Contraste de texto usando text-gray-700 (#374151) */}
              <p className="text-sm sm:text-base leading-relaxed text-gray-700 mb-5 max-w-xl">
                Respondé preguntas cortas sobre tu situación actual y te mostramos un panorama
                realista antes de tomar la decisión — incluyendo los gastos veterinarios que la
                mayoría no anticipa y las mascotas compatibles disponibles.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => navigateTo('step1')}
                  className="px-6 py-3 rounded-xl bg-brand-accent hover:bg-brand-accent/95 text-white font-bold text-sm sm:text-base cursor-pointer shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 flex items-center justify-center gap-2"
                >
                  <span>Empezar evaluación</span>
                  <FiArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenVoiceConsent}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-[1.5px] border-brand-accent text-brand-accent bg-brand-accent-tint hover:bg-brand-accent hover:text-white font-bold text-sm sm:text-base cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
                >
                  <FiMic className="w-4 h-4 flex-shrink-0" />
                  <span>Responder con mi voz</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('fuentes')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-[1.5px] border-brand-line hover:border-brand-accent bg-white text-gray-700 font-semibold text-sm sm:text-base cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
                >
                  <FiInfo className="w-4 h-4 flex-shrink-0" />
                  <span>Solo quiero información</span>
                </button>
              </div>
            </div>

            {/* Tarjeta lateral de resumen en Desktop */}
            <div className="lg:col-span-5 bg-brand-bg/70 border border-brand-line rounded-xl p-4 sm:p-5">
              <h2 className="text-sm font-bold text-brand-ink mb-3">
                ¿Qué analiza nuestro sistema de Match?
              </h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-brand-accent text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-brand-ink">
                      Espacio y tipo de vivienda
                    </h3>
                    <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">
                      Verificamos si cada mascota se adapta a un apartamento o si requiere patio y
                      mayor espacio.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-brand-accent text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-brand-ink">
                      Presupuesto mensual realista
                    </h3>
                    <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">
                      Comparamos tu presupuesto en colones con el costo mensual estimado y el fondo de
                      salud inicial.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-brand-accent text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-brand-ink">
                      Disponibilidad de tiempo diario
                    </h3>
                    <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">
                      Evaluamos las horas de atención activa que necesita cada mascota disponible en
                      adopción.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* PASO 1: SELECCIÓN DE MASCOTA (TIPO Y TAMAÑO)                               */
  /* -------------------------------------------------------------------------- */
  if (screen === 'step1') {
    const petTypes = [
      {
        value: 'Perro',
        label: 'Perro',
        desc: 'Compañía activa, paseos diarios y socialización constante.',
      },
      {
        value: 'Gato',
        label: 'Gato',
        desc: 'Independencia moderada, adaptación a interiores y rutinas tranquilas.',
      },
      {
        value: 'Otro',
        label: 'Otro / no lo sé aún',
        desc: 'Conejos, cobayas u otras especies de compañía.',
      },
    ];
    const petSizes = [
      {
        value: 'Pequeño',
        desc: 'Ideal para espacios reducidos y menor consumo de alimento.',
      },
      {
        value: 'Mediano',
        desc: 'Equilibrio entre energía, espacio moderado y presupuesto medio.',
      },
      {
        value: 'Grande',
        desc: 'Requiere mayor espacio físico, actividad y presupuesto mensual.',
      },
    ];

    return (
      <>
        <VoiceConsentModal
          isOpen={showConsentModal}
          onAccept={handleAcceptConsent}
          onClose={() => setShowConsentModal(false)}
        />

        <section className="bg-brand-surface border border-brand-line rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm max-w-3xl mx-auto w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Sobre la mascota
            </div>
            {voiceToggleChip}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-brand-ink mb-1">
            ¿Qué mascota te interesa adoptar?
          </h1>
          <p className="text-xs sm:text-sm text-gray-700 mb-3">
            Seleccioná el tipo y el tamaño aproximado para ajustar los cálculos y buscar mascotas
            compatibles en adopción.
          </p>

          {/* Panel del Asistente de Voz */}
          <VoiceAssistantPanel
            voiceState={voiceStateProp}
            onMicToggle={handleMicToggle}
            onConfirmYes={handleConfirmYes}
            onConfirmNo={handleConfirmNo}
            onSubmitSimText={(txt) => handleUtterance([txt])}
            onToggleSim={() => setVoiceSim((prev) => !prev)}
            onToggleTts={(chk) => {
              setVoiceTts(chk);
              if (!chk && typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
              }
            }}
          />

          {/* Auditoría #2: Botones nativos <button type="button"> para navegación por teclado */}
          <div className="mb-3.5">
            <span className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">
              1. Tipo de mascota
            </span>
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
              role="radiogroup"
              aria-label="¿Qué mascota te interesa?"
            >
              {petTypes.map((opt) => {
                const isSelected = mascota === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectOption('mascota', opt.value)}
                    className={`text-left rounded-xl p-2.5 sm:p-3 border-2 transition cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 ${
                      isSelected
                        ? 'border-brand-accent bg-brand-accent-tint text-brand-ink shadow-sm voice-flash'
                        : 'border-brand-line bg-brand-surface text-brand-ink hover:border-brand-accent/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm sm:text-base font-bold">{opt.label}</span>
                      <span
                        aria-hidden="true"
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'border-brand-accent bg-brand-accent' : 'border-gray-400'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <span className="text-xs text-gray-700 leading-snug">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tamaño aproximado */}
          <div className="mb-3.5">
            <span className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">
              2. Tamaño aproximado
            </span>
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
              role="radiogroup"
              aria-label="Tamaño aproximado"
            >
              {petSizes.map((size) => {
                const isSelected = tamano === size.value;
                return (
                  <button
                    key={size.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectOption('tamano', size.value)}
                    className={`text-left rounded-xl p-2.5 sm:p-3 border-2 transition cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 ${
                      isSelected
                        ? 'border-brand-accent bg-brand-accent-tint text-brand-ink shadow-sm voice-flash'
                        : 'border-brand-line bg-brand-surface text-brand-ink hover:border-brand-accent/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm sm:text-base font-bold">{size.value}</span>
                      <span
                        aria-hidden="true"
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'border-brand-accent bg-brand-accent' : 'border-gray-400'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <span className="text-xs text-gray-700 leading-snug">
                      {size.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auditoría #1: Nota al pie con text-gray-700 (#374151) */}
          <p className="text-xs text-gray-700 bg-brand-bg/60 rounded-lg p-2.5 border border-brand-line leading-tight">
            Los cálculos se basan en el consumo y cuidados promedio para esta categoría, no en una
            raza específica.
          </p>

          <div className="mt-4 pt-3 border-t border-brand-line flex items-center justify-between gap-3">
            {canGoBack ? (
              <button
                type="button"
                onClick={goBack}
                className="py-2.5 px-5 rounded-xl border-2 border-brand-line hover:border-brand-accent/60 bg-white text-gray-700 font-semibold text-sm cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent flex items-center gap-1.5"
              >
                <span aria-hidden="true">&larr;</span>
                <span>Retroceder</span>
              </button>
            ) : (
              <div />
            )}
            <button
              type="button"
              disabled={!mascota || !tamano}
              onClick={handleStep1Continue}
              className="py-2.5 px-6 rounded-xl bg-brand-accent text-white font-bold text-sm sm:text-base cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
            >
              Continuar al Paso 2 &rarr;
            </button>
          </div>
        </section>
      </>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* PASO 2: SITUACIÓN ACTUAL (VIVIENDA, PRESUPUESTO, HORAS)                    */
  /* -------------------------------------------------------------------------- */
  if (screen === 'step2') {
    const viviendaOptions = [
      {
        value: 'Apartamento',
        label: 'Apartamento',
        sub: 'Evaluamos adaptabilidad de espacio y temperamento',
      },
      {
        value: 'Casa con patio',
        label: 'Casa con patio',
        sub: 'Espacio exterior propio para juego y movilidad',
      },
      {
        value: 'Casa sin patio',
        label: 'Casa sin patio',
        sub: 'Ambiente interior amplio con salidas programadas',
      },
    ];

    register('vivienda', { required: 'Seleccioná tu tipo de vivienda para continuar.' });

    return (
      <>
        <VoiceConsentModal
          isOpen={showConsentModal}
          onAccept={handleAcceptConsent}
          onClose={() => setShowConsentModal(false)}
        />

        <section className="bg-brand-surface border border-brand-line rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm max-w-3xl mx-auto w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Tu situación actual
            </div>
            {voiceToggleChip}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-brand-ink mb-1">
            Contanos de tu espacio, presupuesto y tiempo
          </h1>
          <p className="text-xs sm:text-sm text-gray-700 mb-3">
            Estos tres factores nos permiten calcular tu compatibilidad real con cada mascota.
          </p>

          {/* Panel del Asistente de Voz */}
          <VoiceAssistantPanel
            voiceState={voiceStateProp}
            onMicToggle={handleMicToggle}
            onConfirmYes={handleConfirmYes}
            onConfirmNo={handleConfirmNo}
            onSubmitSimText={(txt) => handleUtterance([txt])}
            onToggleSim={() => setVoiceSim((prev) => !prev)}
            onToggleTts={(chk) => {
              setVoiceTts(chk);
              if (!chk && typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
              }
            }}
          />

          <div className="mb-3.5">
            <span className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">
              1. Tipo de vivienda
            </span>

            {/* Auditoría #2: Botones nativos <button type="button"> */}
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
              role="radiogroup"
              aria-label="Tipo de vivienda"
            >
              {viviendaOptions.map((opt) => {
                const isSelected = vivienda === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectOption('vivienda', opt.value)}
                    className={`text-left rounded-xl p-2.5 sm:p-3 border-2 transition cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 ${
                      isSelected
                        ? 'border-brand-accent bg-brand-accent-tint text-brand-ink shadow-sm voice-flash'
                        : 'border-brand-line bg-brand-surface text-brand-ink hover:border-brand-accent/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm sm:text-base font-bold">{opt.label}</span>
                      <span
                        aria-hidden="true"
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'border-brand-accent bg-brand-accent' : 'border-gray-400'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <span
                      className={`block text-xs leading-snug ${
                        isSelected ? 'text-brand-accent font-medium' : 'text-gray-700'
                      }`}
                    >
                      {opt.sub}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.vivienda && (
              <div className="text-xs font-semibold text-brand-err-ink mt-1.5" role="alert">
                {errors.vivienda.message}
              </div>
            )}
          </div>

          {/* Grid de 2 columnas para Presupuesto y Horas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3.5">
            <div className="bg-brand-bg/50 border border-brand-line rounded-xl p-3 sm:p-3.5">
              <label
                htmlFor="presupuestoInput"
                className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5"
              >
                2. Presupuesto mensual estimado (colones ₡)
              </label>
              <input
                id="presupuestoInput"
                type="number"
                placeholder="Ej. 35000"
                {...register('presupuesto', {
                  required: 'Ingresá un monto mayor a 0 para poder calcular tu panorama.',
                  validate: (val) =>
                    Number(val) > 0 || 'Ingresá un monto mayor a 0 para poder calcular tu panorama.',
                })}
                className={`w-full px-3 py-2 rounded-lg border-2 text-sm bg-brand-surface text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                  errors.presupuesto ? 'border-brand-err-line' : 'border-brand-line'
                }`}
              />
              {errors.presupuesto && (
                <div className="text-xs font-semibold text-brand-err-ink mt-1.5" role="alert">
                  {errors.presupuesto.message}
                </div>
              )}
              <p className="text-xs text-gray-700 mt-1.5 leading-snug">
                Este monto se compara con la manutención mensual de cada mascota y el fondo de salud
                por separado.
              </p>
            </div>

            <div className="bg-brand-bg/50 border border-brand-line rounded-xl p-3 sm:p-3.5">
              <label
                htmlFor="tiempoInput"
                className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5"
              >
                3. Horas disponibles al día (aproximado)
              </label>
              <input
                id="tiempoInput"
                type="number"
                min="0"
                max="24"
                step="0.5"
                placeholder="Ej. 2"
                {...register('tiempo', {
                  required: 'Ingresá un número de horas entre 0 y 24 para continuar.',
                  validate: (val) => {
                    const num = parseFloat(val);
                    return (
                      (!isNaN(num) && num >= 0 && num <= 24) ||
                      'Ingresá un número de horas entre 0 y 24 para continuar.'
                    );
                  },
                })}
                className={`w-full px-3 py-2 rounded-lg border-2 text-sm bg-brand-surface text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                  errors.tiempo ? 'border-brand-err-line' : 'border-brand-line'
                }`}
              />
              {errors.tiempo && (
                <div className="text-xs font-semibold text-brand-err-ink mt-1.5" role="alert">
                  {errors.tiempo.message}
                </div>
              )}
              <p className="text-xs text-gray-700 mt-1.5 leading-snug">
                Escribí el número de horas diarias que podés dedicarle entre paseos, juego y cuidados
                directos.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-line flex items-center justify-between gap-3">
            {canGoBack ? (
              <button
                type="button"
                onClick={goBack}
                className="py-2.5 px-5 rounded-xl border-2 border-brand-line hover:border-brand-accent/60 bg-white text-gray-700 font-semibold text-sm cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent flex items-center gap-1.5"
              >
                <span aria-hidden="true">&larr;</span>
                <span>Retroceder</span>
              </button>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={handleStep2Continue}
              className="py-2.5 px-6 rounded-xl bg-brand-accent text-white font-bold text-sm sm:text-base cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
            >
              Continuar al Paso 3 &rarr;
            </button>
          </div>
        </section>
      </>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* PASO 3: EXPERIENCIA Y DUDAS                                                */
  /* -------------------------------------------------------------------------- */
  if (screen === 'step3') {
    const dudasOptions = [
      'Costos de manutención y emergencias',
      'Cuidados diarios / salud preventiva',
      'Tiempo / compromiso a largo plazo',
      'Requisitos del refugio o persona responsable',
    ];

    register('experiencia', { required: 'Elegí una opción para poder continuar.' });

    return (
      <>
        <VoiceConsentModal
          isOpen={showConsentModal}
          onAccept={handleAcceptConsent}
          onClose={() => setShowConsentModal(false)}
        />

        <section className="bg-brand-surface border border-brand-line rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm max-w-3xl mx-auto w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Tu experiencia
            </div>
            {voiceToggleChip}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-brand-ink mb-1">
            Experiencia previa y principales inquietudes
          </h1>
          <p className="text-xs sm:text-sm text-gray-700 mb-3">
            Contanos si ya has convivido con mascotas y qué aspectos te gustaría tener más claros.
          </p>

          {/* Panel del Asistente de Voz */}
          <VoiceAssistantPanel
            voiceState={voiceStateProp}
            onMicToggle={handleMicToggle}
            onConfirmYes={handleConfirmYes}
            onConfirmNo={handleConfirmNo}
            onSubmitSimText={(txt) => handleUtterance([txt])}
            onToggleSim={() => setVoiceSim((prev) => !prev)}
            onToggleTts={(chk) => {
              setVoiceTts(chk);
              if (!chk && typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
              }
            }}
          />

          <div className="mb-3.5">
            <span className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">
              1. ¿Has tenido mascotas antes?
            </span>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl"
              role="radiogroup"
              aria-label="¿Has tenido mascotas antes?"
            >
              {[
                { value: 'Sí', desc: 'Ya conozco la rutina básica de convivencia.' },
                { value: 'No', desc: 'Sería mi primera experiencia adoptando.' },
              ].map((expOpt) => {
                const isSelected = experiencia === expOpt.value;
                return (
                  <button
                    key={expOpt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectOption('experiencia', expOpt.value)}
                    className={`text-left rounded-xl p-2.5 sm:p-3 border-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 ${
                      isSelected
                        ? 'border-brand-accent bg-brand-accent-tint text-brand-ink shadow-sm voice-flash'
                        : 'border-brand-line bg-brand-surface text-brand-ink hover:border-brand-accent/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm sm:text-base font-bold">{expOpt.value}</span>
                      <span
                        aria-hidden="true"
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'border-brand-accent bg-brand-accent' : 'border-gray-400'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <span className="text-xs text-gray-700">{expOpt.desc}</span>
                  </button>
                );
              })}
            </div>
            {errors.experiencia && (
              <div className="text-xs font-semibold text-brand-err-ink mt-1.5" role="alert">
                {errors.experiencia.message}
              </div>
            )}
          </div>

          <div className="mb-3.5">
            <span className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">
              2. ¿Qué te genera más duda al adoptar? (Opcional, podés elegir varias)
            </span>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
              role="group"
              aria-label="¿Qué te genera más duda al adoptar?"
            >
              {dudasOptions.map((item) => {
                const isChecked = Array.isArray(dudas) && dudas.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => handleToggleDuda(item)}
                    className={`flex items-center gap-2.5 border-2 rounded-xl px-3 py-2 cursor-pointer text-xs sm:text-sm text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 ${
                      isChecked
                        ? 'border-brand-accent bg-brand-accent-tint font-semibold text-brand-ink'
                        : 'border-brand-line bg-brand-surface font-medium text-brand-ink hover:border-brand-accent/60'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                        isChecked
                          ? 'bg-brand-accent border-brand-accent text-white'
                          : 'bg-brand-surface border-gray-400'
                      }`}
                    >
                      {isChecked && (
                        <FiCheck className="w-3 h-3 stroke-[3]" />
                      )}
                    </span>
                    <span>{item}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-line flex items-center justify-between gap-3">
            {canGoBack ? (
              <button
                type="button"
                onClick={goBack}
                className="py-2.5 px-5 rounded-xl border-2 border-brand-line hover:border-brand-accent/60 bg-white text-gray-700 font-semibold text-sm cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent flex items-center gap-1.5"
              >
                <span aria-hidden="true">&larr;</span>
                <span>Retroceder</span>
              </button>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={handleStep3Submit}
              className="py-2.5 px-6 rounded-xl bg-brand-accent text-white font-bold text-sm sm:text-base cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
            >
              Ver mi panorama y mascotas &rarr;
            </button>
          </div>
        </section>
      </>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* PANTALLA: CARGANDO                                                         */
  /* -------------------------------------------------------------------------- */
  if (screen === 'loading') {
    return (
      <section
        className="bg-brand-surface border border-brand-line rounded-2xl p-8 flex flex-col items-center justify-center min-h-[280px] gap-3 text-gray-700 shadow-sm max-w-xl mx-auto w-full my-auto"
        aria-live="polite"
      >
        <div className="w-8 h-8 rounded-full border-3 border-brand-line border-t-brand-accent animate-spin" />
        <div className="text-base font-semibold text-brand-ink">
          Calculando tu panorama de preparación…
        </div>
        <p className="text-xs sm:text-sm text-gray-700 text-center">
          Analizando mascotas disponibles según tu vivienda, presupuesto y tiempo.
        </p>
      </section>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* PANTALLA: RESULTADOS Y MATCH DE MASCOTAS (DASHBOARD RESPONSIVE)             */
  /* -------------------------------------------------------------------------- */
  if (screen === 'result') {
    const renderPetMatchCard = (pet, isExact) => (
      <article
        key={pet.id}
        className={`rounded-xl border-2 ${
          isExact
            ? 'border-brand-accent bg-brand-accent-tint/60'
            : 'border-brand-warn-line bg-brand-warn-tint/70'
        } p-3.5 flex flex-col justify-between transition shadow-xs`}
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <span
              className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${
                isExact ? 'bg-brand-accent text-white' : 'bg-brand-warn-ink text-white'
              }`}
            >
              {pet.overallStatusTag}
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-white border border-brand-line text-brand-ink whitespace-nowrap">
              {pet.score}% Match
            </span>
          </div>

          {pet.imagen_url ? (
            <div
              className="w-full h-32 sm:h-36 mb-2.5 overflow-hidden rounded-lg border border-brand-line bg-white/50 cursor-zoom-in"
              onClick={() => setExpandedImage({ url: pet.imagen_url, alt: `Foto de ${pet.nombre}` })}
              title="Haz clic para ver de cerca"
            >
              <img
                src={pet.imagen_url}
                alt={`Foto de ${pet.nombre}`}
                className="w-full h-full object-cover hover:scale-105 transition duration-300"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-full h-24 mb-2.5 rounded-lg border border-dashed border-brand-line/80 flex items-center justify-center bg-white/50 text-gray-700 text-xs font-medium gap-1.5">
              <span className="text-xl">
                {pet.tipo === 'Perro' ? '🐶' : pet.tipo === 'Gato' ? '🐱' : '🐾'}
              </span>
              <span>Sin foto</span>
            </div>
          )}

          <h3 className="text-base font-bold text-brand-ink">
            {pet.nombre}{' '}
            <span className="font-normal text-xs text-gray-700">
              · {pet.tipo} ({pet.tamano})
            </span>
          </h3>

          <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2.5 text-[11px] text-gray-700 font-medium">
            <span className="bg-white/90 px-2 py-0.5 rounded border border-brand-line">
              Costo: {formatColones(pet.costo_mensual_estimado)}/mes
            </span>
            <span className="bg-white/90 px-2 py-0.5 rounded border border-brand-line">
              Atención: {pet.horas_minimas_atencion} h/día
            </span>
          </div>

          <ul className="space-y-1 mt-2 pt-2 border-t border-brand-line/70">
            {pet.checks.map((chk) => (
              <li
                key={chk.key}
                className="text-[11px] text-gray-700 leading-tight flex flex-col"
              >
                <span
                  className={`font-bold ${
                    chk.ok ? 'text-brand-accent' : 'text-brand-warn-ink'
                  }`}
                >
                  {chk.statusTag}
                </span>
                <span>{chk.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* BOTÓN PARA ABRIR EL MODAL DE CONTACTO */}
        <button
          type="button"
          onClick={() => setContactModalPet(pet)}
          className={`w-full mt-3.5 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs ${
            isExact
              ? 'bg-brand-accent hover:bg-brand-accent/90 text-white'
              : 'bg-brand-warn-ink hover:bg-brand-warn-ink/90 text-white'
          }`}
        >
          <FiPhone className="w-3.5 h-3.5" />
          <span>Contactar para adopción</span>
        </button>
      </article>
    );

    return (
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start relative">
        {toastMsg && (
          <div
            role="status"
            className="fixed bottom-5 right-5 z-40 bg-brand-ink text-white px-4 py-2.5 rounded-xl shadow-lg text-xs sm:text-sm font-semibold flex items-center gap-2 animate-bounce"
          >
            <span className="w-2 h-2 rounded-full bg-brand-accent" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* BANNER SUPERIOR DEL ESCENARIO (1, 2, 3 o 4) */}
        {currentScenario === 1 && (
          <div className="lg:col-span-12 bg-brand-accent-tint border-2 border-brand-accent/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start sm:items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-brand-accent text-white flex items-center justify-center font-bold text-base flex-shrink-0 mt-0.5 sm:mt-0">
                ✓
              </span>
              <div>
                <div className="inline-block text-xs font-bold text-brand-accent uppercase tracking-wide">
                  ¡Perfil Apto + Con Match!
                </div>
                <h2 className="text-base sm:text-lg font-bold text-brand-ink">
                  ¡Estás preparado para adoptar y encontramos mascotas compatibles!
                </h2>
                <p className="text-xs sm:text-sm text-gray-700 leading-snug">
                  Tus condiciones de espacio, tiempo y presupuesto encajan perfectamente con las mascotas que te mostramos a continuación.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-brand-accent text-white font-bold text-xs whitespace-nowrap self-start sm:self-auto">
              {exactMatches.length} {exactMatches.length === 1 ? 'mascota compatible' : 'mascotas compatibles'}
            </span>
          </div>
        )}

        {currentScenario === 2 && (
          <div className="lg:col-span-12 bg-sky-50 border-2 border-sky-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start sm:items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-base flex-shrink-0 mt-0.5 sm:mt-0">
                ★
              </span>
              <div>
                <div className="inline-block text-xs font-bold text-sky-700 uppercase tracking-wide">
                  ¡Perfil Apto para Adoptar!
                </div>
                <h2 className="text-base sm:text-lg font-bold text-brand-ink">
                  Cumples con excelentes condiciones para adoptar
                </h2>
                <p className="text-xs sm:text-sm text-gray-700 leading-snug">
                  Tu vivienda, disponibilidad de tiempo y presupuesto son adecuados para la mascota que buscas. En este momento no hay mascotas en adopción registradas que coincidan al 100%, pero tu perfil es idóneo para adoptar en refugios aliados.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('fuentes')}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 text-white font-bold text-xs whitespace-nowrap hover:bg-sky-700 transition cursor-pointer self-start sm:self-auto"
            >
              Ver refugios aliados &rarr;
            </button>
          </div>
        )}

        {currentScenario === 3 && (
          <div className="lg:col-span-12 bg-brand-warn-tint border-2 border-brand-warn-line/70 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start sm:items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-brand-warn-line text-white flex items-center justify-center font-bold text-base flex-shrink-0 mt-0.5 sm:mt-0">
                !
              </span>
              <div>
                <div className="inline-block text-xs font-bold text-brand-warn-ink uppercase tracking-wide">
                  Puntos a considerar antes de adoptar
                </div>
                <h2 className="text-base sm:text-lg font-bold text-brand-ink">
                  Hay aspectos importantes que deberías ajustar
                </h2>
                <p className="text-xs sm:text-sm text-gray-700 leading-snug">
                  Revisa los puntos señalados en tu diagnóstico. A la derecha te mostramos mascotas registradas indicando con honestidad qué diferencias existen con tus condiciones actuales.
                </p>
              </div>
            </div>
          </div>
        )}

        {currentScenario === 4 && (
          <div className="lg:col-span-12 bg-brand-warn-tint border-2 border-brand-warn-line/70 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start sm:items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-brand-warn-line text-white flex items-center justify-center font-bold text-base flex-shrink-0 mt-0.5 sm:mt-0">
                i
              </span>
              <div>
                <div className="inline-block text-xs font-bold text-brand-warn-ink uppercase tracking-wide">
                  Orientación de preparación
                </div>
                <h2 className="text-base sm:text-lg font-bold text-brand-ink">
                  Te recomendamos fortalecer algunos aspectos antes de dar el paso
                </h2>
                <p className="text-xs sm:text-sm text-gray-700 leading-snug">
                  Revisa las recomendaciones para fortalecer tu disponibilidad y presupuesto. Actualmente tampoco hay mascotas en adopción que coincidan con estos parámetros.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* COLUMNA IZQUIERDA: Panorama General de Aptitud, Desglose de Costos y Acciones */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-brand-surface border border-brand-line rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Tu panorama de preparación
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  adopterAptitude.isApto
                    ? 'bg-brand-accent-tint text-brand-accent border border-brand-accent/30'
                    : 'bg-brand-warn-tint text-brand-warn-ink border border-brand-warn-line/50'
                }`}
              >
                {adopterAptitude.statusTag}
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-brand-ink mb-3">
              Evaluación del adoptante
            </h1>

            {/* Indicadores Generales Dinámicos */}
            <div className="flex flex-col gap-2">
              {adopterAptitude.indicators.map((ind) => (
                <div
                  key={ind.id}
                  className={`border-2 rounded-xl p-2.5 sm:p-3 flex gap-2.5 items-start ${
                    ind.ok
                      ? 'border-brand-accent bg-brand-accent-tint'
                      : 'border-brand-warn-line bg-brand-warn-tint'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                      ind.ok ? 'bg-brand-accent' : 'bg-brand-warn-line'
                    }`}
                  >
                    {ind.ok ? (
                      <FiCheck className="w-3 h-3 text-white stroke-[2.8]" />
                    ) : (
                      <FiAlertCircle className="w-3.5 h-3.5 text-white" />
                    )}
                  </span>
                  <div className="flex-1">
                    <div className="mb-0.5">
                      <span
                        className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          ind.ok
                            ? 'bg-brand-accent text-white'
                            : 'bg-brand-warn-ink text-white'
                        }`}
                      >
                        {ind.statusTag}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-brand-ink">{ind.title}</div>
                    <div className="text-xs text-gray-700 mt-0.5 leading-snug">
                      {ind.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desglose estimado de costos (Dinámico según base de datos) */}
            <div className="border border-brand-line rounded-xl p-3 mt-3 bg-white">
              <h2 className="text-xs sm:text-sm font-bold text-brand-ink mb-2">
                Estimación de referencia ({mascota || 'Mascota'} · {tamano || 'Mediano'})
              </h2>
              <div className="flex justify-between pb-1.5 text-xs">
                <span className="text-gray-700 font-medium">Manutención mensual promedio</span>
                <span className="font-bold text-brand-ink">
                  ≈ {formatColones(adopterAptitude.referenceCost)}
                </span>
              </div>
              <div className="flex justify-between bg-brand-warn-tint -mx-3 px-3 py-1.5 my-1 text-xs">
                <span className="text-brand-warn-ink font-semibold">Fondo salud (reserva inicial)</span>
                <span className="font-bold text-brand-warn-ink">
                  ≈ {formatColones(adopterAptitude.referenceSalud)}
                </span>
              </div>
              <p className="text-[11px] text-gray-700 mt-1.5 leading-snug">
                Calculado a partir de los datos registrados de esta categoría. El fondo de salud es una reserva preventiva recomendada para vacunas o emergencias.
              </p>
            </div>

            {/* Disclaimer */}
            <div className="bg-brand-warn-tint border border-brand-warn-line rounded-xl p-2.5 flex gap-2 mt-3">
              <span
                aria-hidden="true"
                className="w-4 h-4 rounded-full border border-brand-warn-line text-brand-warn-ink flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5"
              >
                i
              </span>
              <p className="m-0 text-xs leading-snug text-brand-warn-ink font-medium">
                <span className="font-bold">[Atención]</span> Diagnóstico orientativo. No sustituye consulta veterinaria ni garantiza adopción inmediata.
              </p>
            </div>

            {/* Botones de acción del resultado */}
            <div className="flex flex-col gap-2 mt-4">
              {/* Botón para escuchar el resumen del panorama por síntesis de voz */}
              {typeof window !== 'undefined' && 'speechSynthesis' in window && (
                <button
                  type="button"
                  onClick={handleListenResultSummary}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-brand-accent/40 bg-brand-accent-tint hover:bg-brand-accent hover:text-white text-brand-accent font-bold text-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                >
                  <FiVolume2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Escuchar resumen en voz alta</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => navigateTo('fuentes')}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-accent hover:bg-brand-accent/95 text-white font-bold text-xs sm:text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                Ver fuentes confiables y albergues
              </button>
              <button
                type="button"
                onClick={() => navigateTo('confirmacion')}
                className="w-full py-2 px-4 rounded-xl border border-brand-line hover:border-brand-accent bg-white text-brand-ink font-semibold text-xs sm:text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                Guardar / descargar mi resumen
              </button>

              {canGoBack && (
                <button
                  type="button"
                  onClick={goBack}
                  className="w-full py-2 px-4 rounded-xl border-2 border-brand-line hover:border-brand-accent/60 bg-white text-gray-700 font-semibold text-xs sm:text-sm cursor-pointer transition flex items-center justify-center gap-1.5 mt-1"
                >
                  <span aria-hidden="true">&larr;</span>
                  <span>Retroceder y ajustar respuestas</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: MASCOTAS EN ADOPCIÓN (SUPABASE) */}
        <div className="lg:col-span-7 bg-brand-surface border border-brand-line rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-base sm:text-lg font-bold text-brand-ink">
              Mascotas en adopción
            </h2>
            {exactMatches.length > 0 ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-accent-tint text-brand-accent border border-brand-accent/25">
                {exactMatches.length} {exactMatches.length === 1 ? 'Match' : 'Matches'}
              </span>
            ) : matchedPets.length > 0 ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-warn-tint text-brand-warn-ink border border-brand-warn-line/30">
                Compatibilidad cercana
              </span>
            ) : null}
          </div>

          <p className="text-xs sm:text-sm text-gray-700 mb-3 leading-snug">
            Comparamos tu presupuesto (<strong>{formatColones(presupuesto)}</strong>), tiempo disponible (
            <strong>{tiempo} h/día</strong>) y vivienda (<strong>{vivienda}</strong>) con cada mascota disponible.
          </p>

          {/* CASO: NO HAY MASCOTAS EN ADOPCIÓN */}
          {matchedPets.length === 0 && (
            <div className="p-6 text-center rounded-2xl border-2 border-dashed border-brand-line bg-brand-bg/50 flex flex-col items-center justify-center gap-3">
              <span className="text-3xl" aria-hidden="true">
                {mascota === 'Perro' ? '🐶' : mascota === 'Gato' ? '🐱' : '🐾'}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-brand-ink">
                No hay mascotas activas de tipo &ldquo;{mascota}&rdquo; registradas actualmente
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 max-w-md leading-relaxed">
                {adopterAptitude.isApto
                  ? '¡Tu perfil es totalmente apto para adoptar! En este momento ningún albergue o persona administradora ha registrado una mascota de esta categoría. Te invitamos a consultar el directorio de refugios aliados o volver a revisar pronto.'
                  : 'Te invitamos a revisar las guías de cuidado y recomendaciones en nuestro directorio para preparar tu hogar y tus tiempos antes de adoptar.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => navigateTo('fuentes')}
                  className="py-2 px-4 rounded-xl bg-brand-accent text-white font-bold text-xs cursor-pointer hover:bg-brand-accent/95 transition"
                >
                  Ver directorio de refugios y albergues
                </button>
              </div>
            </div>
          )}

          {/* CASO: HAY MASCOTAS EN ADOPCIÓN */}
          {matchedPets.length > 0 && (
            <div className="space-y-5">
              {/* Sección de Matches Exactos */}
              {exactMatches.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-brand-accent uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-accent" />
                    <span>Mascotas compatibles</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {exactMatches.map((pet) => renderPetMatchCard(pet, true))}
                  </div>
                </div>
              )}

              {/* Sección de Matches Parciales */}
              {partialMatches.length > 0 && (
                <div className={exactMatches.length > 0 ? 'mt-4 pt-4 border-t border-brand-line' : ''}>
                  <div className="text-xs font-bold text-brand-warn-ink uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-warn-line" />
                    <span>
                      {exactMatches.length === 0
                        ? `Mascotas con compatibilidad cercana (${partialMatches.length})`
                        : `Otras mascotas con diferencias a considerar (${partialMatches.length})`}
                    </span>
                  </div>

                  {exactMatches.length === 0 && (
                    <p className="text-xs text-gray-700 mb-2.5 leading-snug">
                      No hay mascotas con match al 100%, pero estas opciones son cercanas evaluando tus condiciones:
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {partialMatches.map((pet) => renderPetMatchCard(pet, false))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {renderLightbox()}
        {renderContactModal()}
      </section>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* PANTALLA: CONFIRMACIÓN                                                     */
  /* -------------------------------------------------------------------------- */
  if (screen === 'confirmacion') {
    return (
      <section className="bg-brand-surface border border-brand-line rounded-2xl p-6 sm:p-8 shadow-sm max-w-xl mx-auto w-full text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          <div
            className="w-12 h-12 rounded-full bg-brand-accent-tint flex items-center justify-center text-brand-accent"
            aria-hidden="true"
          >
            <FiCheck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-brand-ink">
            ¡Listo! Tu resumen fue guardado
          </h1>
          <p className="text-xs sm:text-sm leading-relaxed text-gray-700 max-w-md">
            Llegaste al final del proceso. Guardamos el panorama de{' '}
            <strong className="text-brand-ink">
              {mascota ? `tu ${mascota.toLowerCase()}` : 'tu mascota'}
            </strong>{' '}
            con el desglose de costos y las alertas de compatibilidad revisadas.
          </p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-2.5">
          <button
            type="button"
            onClick={handleResetAll}
            className="py-2.5 px-6 rounded-xl bg-brand-accent text-white font-bold text-xs sm:text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            Volver al inicio
          </button>
          <button
            type="button"
            onClick={() => navigateTo('fuentes')}
            className="py-2.5 px-6 rounded-xl border-2 border-brand-line bg-white text-brand-ink font-semibold text-xs sm:text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            Ver fuentes confiables
          </button>
        </div>

        {renderLightbox()}
      </section>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* PANTALLA: FUENTES CONFIABLES                                               */
  /* -------------------------------------------------------------------------- */
  if (screen === 'fuentes') {
    const sources = [
      {
        key: 'albergues',
        t: 'Refugios verificados',
        d: `Organizaciones y personas responsables cerca de tu ubicación (${publicRefugios.length} activos).`,
      },
      {
        key: 'veterinarios',
        t: 'Veterinarios recomendados',
        d: `Clínicas con atención preventiva, urgencias y especialistas (${publicVeterinarios.length} activos).`,
      },
      {
        key: 'guias',
        t: 'Guías de cuidado',
        d: `Recomendaciones y documentos de nutrición, salud y bienestar (${publicGuias.length} activas).`,
      },
    ];

    return (
      <section className="bg-brand-surface border border-brand-line rounded-2xl p-5 sm:p-7 shadow-sm max-w-4xl mx-auto w-full">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
          Fuentes de información
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-brand-ink mb-1">
          Directorio de fuentes confiables
        </h1>
        <p className="text-xs sm:text-sm text-gray-700 mb-4">
          Consultá albergues verificados, clínicas veterinarias y guías prácticas antes de dar el
          siguiente paso.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {sources.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => openDetalle(s.key)}
              className="flex flex-col justify-between text-left text-brand-ink bg-brand-bg/50 border-2 border-brand-line hover:border-brand-accent rounded-xl p-3.5 sm:p-4 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            >
              <div>
                <strong className="text-sm sm:text-base font-bold text-brand-ink block mb-1">
                  {s.t}
                </strong>
                <span className="block text-xs text-gray-700 leading-snug">
                  {s.d}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-accent mt-3">
                Explorar sección <span aria-hidden="true">&rarr;</span>
              </span>
            </button>
          ))}
        </div>

        <div className="pt-3.5 border-t border-brand-line flex items-center justify-start">
          {canGoBack && (
            <button
              type="button"
              onClick={goBack}
              className="py-2.5 px-5 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm cursor-pointer transition flex items-center gap-1.5 shadow-xs"
            >
              <FiArrowLeft className="w-4 h-4" />
              <span>Retroceder</span>
            </button>
          )}
        </div>
      </section>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* PANTALLA: DETALLE DE FUENTES                                               */
  /* -------------------------------------------------------------------------- */
  if (screen === 'detalle') {
    const meta = getDetalleMeta(detalleKey);

    return (
      <section className="bg-brand-surface border border-brand-line rounded-2xl p-5 sm:p-7 shadow-sm max-w-4xl mx-auto w-full">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
          {meta.eyebrow}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-brand-ink mb-1">{meta.title}</h1>
        <p className="text-xs sm:text-sm text-gray-700 mb-4">
          {meta.desc}
        </p>

        {loadingResources ? (
          <div className="py-12 text-center text-sm text-gray-600">Cargando información verificada...</div>
        ) : null}

        {/* VISTA DETALLE: REFUGIOS VERIFICADOS */}
        {!loadingResources && detalleKey === 'albergues' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-5">
            {publicRefugios.length === 0 ? (
              <div className="col-span-full py-8 text-center text-sm text-gray-600 border-2 border-dashed border-brand-line rounded-xl">
                No hay refugios activos registrados en este momento.
              </div>
            ) : (
              publicRefugios.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedResource({ ...r, _type: 'refugio' })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedResource({ ...r, _type: 'refugio' }); }}
                  className="border-2 border-brand-line hover:border-brand-accent rounded-xl p-3 bg-white flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group text-left"
                >
                  <div>
                    {r.imagen_url ? (
                      <div
                        className="w-full h-32 rounded-lg overflow-hidden mb-2.5 bg-gray-100 cursor-zoom-in"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedImage({ url: r.imagen_url, alt: r.nombre });
                        }}
                        title="Haz clic para ver foto ampliada"
                      >
                        <img
                          src={r.imagen_url}
                          alt={r.nombre}
                          className="w-full h-full object-cover hover:scale-105 transition duration-300"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-24 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-2.5 text-emerald-600">
                        <FaHouse className="w-8 h-8" />
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <FiCheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Verificado</span>
                      </span>
                    </div>
                    <strong className="text-sm font-bold text-brand-ink block truncate group-hover:text-brand-accent transition">
                      {r.nombre}
                    </strong>
                    {r.direccion && (
                      <p className="text-xs text-gray-600 truncate mt-0.5 flex items-center gap-1">
                        <FiMapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{r.direccion}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 mt-2 border-t border-brand-line/60 flex items-center justify-between text-xs font-semibold text-brand-accent">
                    <span>Ver</span>
                    <FiArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* VISTA DETALLE: VETERINARIOS RECOMENDADOS */}
        {!loadingResources && detalleKey === 'veterinarios' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-5">
            {publicVeterinarios.length === 0 ? (
              <div className="col-span-full py-8 text-center text-sm text-gray-600 border-2 border-dashed border-brand-line rounded-xl">
                No hay veterinarios recomendados activos registrados en este momento.
              </div>
            ) : (
              publicVeterinarios.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedResource({ ...v, _type: 'veterinario' })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedResource({ ...v, _type: 'veterinario' }); }}
                  className="border-2 border-brand-line hover:border-brand-accent rounded-xl p-3 bg-white flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group text-left"
                >
                  <div>
                    {v.imagen_url ? (
                      <div
                        className="w-full h-32 rounded-lg overflow-hidden mb-2.5 bg-gray-100 cursor-zoom-in"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedImage({ url: v.imagen_url, alt: v.nombre });
                        }}
                        title="Haz clic para ver foto ampliada"
                      >
                        <img
                          src={v.imagen_url}
                          alt={v.nombre}
                          className="w-full h-full object-cover hover:scale-105 transition duration-300"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-24 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center mb-2.5 text-teal-600">
                        <FaStethoscope className="w-8 h-8" />
                      </div>
                    )}
                    <strong className="text-sm font-bold text-brand-ink block truncate group-hover:text-brand-accent transition">
                      {v.nombre}
                    </strong>
                    {v.direccion && (
                      <p className="text-xs text-gray-600 truncate mt-0.5 flex items-center gap-1">
                        <FiMapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{v.direccion}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 mt-2 border-t border-brand-line/60 flex items-center justify-between text-xs font-semibold text-brand-accent">
                    <span>Ver</span>
                    <FiArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* VISTA DETALLE: GUÍAS DE CUIDADO */}
        {!loadingResources && detalleKey === 'guias' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-5">
            {publicGuias.length === 0 ? (
              <div className="col-span-full py-8 text-center text-sm text-gray-600 border-2 border-dashed border-brand-line rounded-xl">
                No hay guías de cuidado activas registradas en este momento.
              </div>
            ) : (
              publicGuias.map((g) => (
                <div
                  key={g.id}
                  onClick={() => setSelectedResource({ ...g, _type: 'guia' })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedResource({ ...g, _type: 'guia' }); }}
                  className="border-2 border-brand-line hover:border-brand-accent rounded-xl p-3.5 bg-white flex flex-col justify-between shadow-xs hover:shadow-md transition-all cursor-pointer group text-left"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-2">
                      <FaBookOpen className="w-5 h-5" />
                    </div>
                    <strong className="text-sm font-bold text-brand-ink block mb-1 group-hover:text-brand-accent transition line-clamp-1">
                      {g.titulo}
                    </strong>
                    <p className="text-xs text-gray-600 line-clamp-2 leading-snug">
                      {g.descripcion}
                    </p>
                  </div>

                  <div className="pt-2 mt-2 border-t border-brand-line/60 flex items-center justify-between text-xs font-semibold text-brand-accent">
                    <span>Ver</span>
                    <FiArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* MODAL DETALLES DE RECURSO */}
        {selectedResource && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setSelectedResource(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-brand-line p-5 sm:p-6 relative text-left animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedResource(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer transition text-lg font-bold"
                aria-label="Cerrar modal"
              >
                <FiX className="w-5 h-5" />
              </button>

              {/* TIPO: REFUGIO */}
              {selectedResource._type === 'refugio' && (
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-3">
                    <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Refugio Verificado</span>
                  </div>

                  {selectedResource.imagen_url && (
                    <div className="flex flex-col items-center mb-4">
                      <img
                        src={selectedResource.imagen_url}
                        alt={selectedResource.nombre}
                        onClick={() => setExpandedImage({ url: selectedResource.imagen_url, alt: selectedResource.nombre })}
                        className="max-w-full max-h-[70vh] w-auto h-auto rounded-xl border border-brand-line shadow-xs object-contain cursor-zoom-in hover:opacity-90 transition"
                        title="Haz clic para ver la imagen ampliada"
                      />
                    </div>
                  )}

                  <h3 className="text-xl font-bold text-brand-ink mb-2">
                    {selectedResource.nombre}
                  </h3>

                  {selectedResource.descripcion && (
                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mb-4 bg-brand-surface/60 p-3 rounded-xl border border-brand-line/50">
                      {selectedResource.descripcion}
                    </p>
                  )}

                  <div className="space-y-2 text-xs sm:text-sm text-gray-700 border-t border-brand-line/60 pt-3">
                    {selectedResource.direccion && (
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-gray-900 shrink-0 flex items-center gap-1">
                          <FiMapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span>Ubicación:</span>
                        </span>
                        <span>{selectedResource.direccion}</span>
                      </div>
                    )}
                    {selectedResource.telefono && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 shrink-0 flex items-center gap-1">
                          <FiPhone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span>Teléfono:</span>
                        </span>
                        <a href={`tel:${selectedResource.telefono}`} className="text-brand-accent hover:underline font-semibold">
                          {selectedResource.telefono}
                        </a>
                      </div>
                    )}
                    {(selectedResource.correo || selectedResource.email) && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 shrink-0 flex items-center gap-1">
                          <FiMail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span>Correo:</span>
                        </span>
                        <a href={`mailto:${selectedResource.correo || selectedResource.email}`} className="text-brand-accent hover:underline font-semibold">
                          {selectedResource.correo || selectedResource.email}
                        </a>
                      </div>
                    )}
                    {(selectedResource.enlace_web || selectedResource.enlaces) && (() => {
                      const rawUrl = selectedResource.enlace_web || selectedResource.enlaces;
                      const href = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
                      return (
                        <div className="pt-2">
                          <span className="block text-xs font-bold text-gray-900 mb-1 flex items-center gap-1">
                            <FiExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>Enlace directo:</span>
                          </span>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline break-all font-semibold text-xs sm:text-sm inline-block"
                          >
                            {rawUrl}
                          </a>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* TIPO: VETERINARIO */}
              {selectedResource._type === 'veterinario' && (
                <div>
                  {selectedResource.especialidad && (
                    <div className="inline-block text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 mb-3">
                      {selectedResource.especialidad}
                    </div>
                  )}

                  {selectedResource.imagen_url && (
                    <div className="flex flex-col items-center mb-4">
                      <img
                        src={selectedResource.imagen_url}
                        alt={selectedResource.nombre}
                        onClick={() => setExpandedImage({ url: selectedResource.imagen_url, alt: selectedResource.nombre })}
                        className="max-w-full max-h-[70vh] w-auto h-auto rounded-xl border border-brand-line shadow-xs object-contain cursor-zoom-in hover:opacity-90 transition"
                        title="Haz clic para ver la imagen ampliada"
                      />
                    </div>
                  )}

                  <h3 className="text-xl font-bold text-brand-ink mb-3">
                    {selectedResource.nombre}
                  </h3>

                  <div className="space-y-2 text-xs sm:text-sm text-gray-700 border-t border-brand-line/60 pt-3">
                    {selectedResource.direccion && (
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-gray-900 shrink-0 flex items-center gap-1">
                          <FiMapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span>Dirección:</span>
                        </span>
                        <span>{selectedResource.direccion}</span>
                      </div>
                    )}
                    {selectedResource.horario && (
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-gray-900 shrink-0 flex items-center gap-1">
                          <FiClock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span>Horario:</span>
                        </span>
                        <span>{selectedResource.horario}</span>
                      </div>
                    )}
                    {selectedResource.telefono && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 shrink-0 flex items-center gap-1">
                          <FiPhone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span>Teléfono:</span>
                        </span>
                        <a href={`tel:${selectedResource.telefono}`} className="text-brand-accent hover:underline font-semibold">
                          {selectedResource.telefono}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TIPO: GUÍA */}
              {selectedResource._type === 'guia' && (
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 mb-3">
                    <FaBookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Guía de Cuidado</span>
                  </div>

                  <h3 className="text-xl font-bold text-brand-ink mb-2">
                    {selectedResource.titulo}
                  </h3>

                  {selectedResource.descripcion && (
                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mb-5 bg-brand-surface/60 p-3.5 rounded-xl border border-brand-line/50">
                      {selectedResource.descripcion}
                    </p>
                  )}

                  {selectedResource.documento_url ? (
                    <a
                      href={selectedResource.documento_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-brand-accent text-white font-bold text-xs sm:text-sm hover:bg-brand-accent/90 transition shadow-sm cursor-pointer"
                    >
                      <FiExternalLink className="w-4 h-4 shrink-0" />
                      <span>Abrir</span>
                    </a>
                  ) : (
                    <p className="text-xs text-gray-500 italic text-center py-2">
                      Esta guía no contiene un documento adjunto para descargar.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-5 pt-3 border-t border-brand-line flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedResource(null)}
                  className="py-2 px-5 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm cursor-pointer transition shadow-xs"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pt-3.5 border-t border-brand-line flex items-center justify-start">
          <button
            type="button"
            onClick={goBack}
            className="py-2.5 px-5 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm cursor-pointer transition flex items-center gap-1.5 shadow-xs"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span>Retroceder</span>
          </button>
        </div>

        {renderLightbox()}
      </section>
    );
  }

  return null;
}
