import React, { useState } from 'react';
import { FiMic, FiMicOff } from 'react-icons/fi';

export function VoiceConsentModal({ isOpen, onAccept, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voiceConsentTitle"
    >
      <div className="bg-brand-surface border border-brand-line rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-xl">
        <div className="w-12 h-12 rounded-full bg-brand-accent-tint flex items-center justify-center mb-4 text-brand-accent">
          <FiMic className="w-6 h-6" />
        </div>

        <h2 id="voiceConsentTitle" className="text-xl sm:text-2xl font-bold text-brand-ink mb-2">
          Asistente de evaluación por voz
        </h2>

        <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-4">
          Respondé las mismas preguntas de la evaluación hablando de forma natural. Antes de avanzar siempre vas a ver lo que entendimos, y podés tocar opciones o escribir en cualquier momento.
        </p>

        <ul className="space-y-2.5 text-xs sm:text-sm text-gray-700 mb-6 bg-brand-bg/50 p-4 rounded-2xl border border-brand-line">
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-2 flex-shrink-0" />
            <span><strong>Escucha activa continua:</strong> al activar el micrófono se queda encendido para que podás hablar y confirmar fluidamente sin tener que tocarlo en cada pregunta. Podés pausarlo cuando gustés.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-2 flex-shrink-0" />
            <span>Tu navegador procesa la voz localmente. Match Responsable no almacena grabaciones ni audios, únicamente tus respuestas seleccionadas.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-2 flex-shrink-0" />
            <span>Si estás en un lugar ruidoso o público, contás con un modo para escribir lo que dirías o tocar directamente las opciones.</span>
          </li>
        </ul>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border-2 border-brand-line bg-white hover:border-brand-accent text-gray-700 font-semibold text-sm cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-accent hover:bg-brand-accent/95 text-white font-bold text-sm sm:text-base cursor-pointer shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            Activar el asistente
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VoiceAssistantPanel({
  voiceState,
  onMicToggle,
  onConfirmYes,
  onConfirmNo,
  onSubmitSimText,
  onToggleSim,
  onToggleTts,
}) {
  const { on, listening, phase, kind, msg, heard, sim, tts, supported } = voiceState;
  const [inputText, setInputText] = useState('');

  if (!on) return null;

  function handleSimSubmit(e) {
    e?.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;
    onSubmitSimText(clean);
    setInputText('');
  }

  const isWarning = kind === 'warn';
  const statusLabel = listening
    ? 'Micrófono activo · Escuchando continuamente…'
    : phase === 'confirm'
    ? 'Confirmá antes de seguir (podés decir sí o corregir)'
    : sim
    ? 'Modo escritura activado'
    : 'Micrófono pausado · Tocá para activar';

  return (
    <div
      role="region"
      aria-label="Asistente de voz"
      aria-live="polite"
      className={`rounded-xl p-3 sm:p-3.5 mb-3 border-2 transition-colors ${
        isWarning
          ? 'border-brand-warn-line bg-brand-warn-tint text-brand-warn-ink'
          : 'border-brand-accent bg-brand-accent-tint text-brand-ink'
      }`}
    >
      {/* Estado del asistente */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
            isWarning ? 'text-brand-warn-ink' : 'text-brand-accent'
          }`}
        >
          Asistente de voz · {statusLabel}
        </span>
        {listening && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-err-ink">
            <span className="w-2 h-2 rounded-full bg-brand-err-line animate-pulse" />
            Micrófono activo
          </span>
        )}
      </div>

      {/* Fila principal: Botón de Micrófono + Mensaje del asistente */}
      <div className="flex items-center gap-3">
        {supported ? (
          <div className="flex flex-col items-center flex-shrink-0">
            <button
              type="button"
              onClick={onMicToggle}
              aria-label={listening ? 'Pausar micrófono' : 'Activar micrófono continuo'}
              title={listening ? 'Pausar micrófono' : 'Activar micrófono continuo'}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center cursor-pointer shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                listening
                  ? 'bg-brand-err-line text-white voice-listening-ring focus-visible:ring-brand-err-line'
                  : 'bg-brand-accent hover:bg-brand-accent/90 text-white focus-visible:ring-brand-accent'
              }`}
            >
              {listening ? (
                <FiMicOff className="w-5 h-5" />
              ) : (
                <FiMic className="w-5 h-5" />
              )}
            </button>
            <span className="text-[9px] text-gray-700 font-bold mt-0.5 text-center">
              {listening ? 'Pausar' : 'Activar'}
            </span>
          </div>
        ) : null}

        <div className="flex-1 min-w-0">
          <div className="text-xs sm:text-sm font-semibold leading-snug">
            {msg}
          </div>
        </div>
      </div>

      {/* Retroalimentación de transcripción detectada */}
      {heard && (
        <div className="mt-2 text-xs text-gray-700 italic bg-white/70 rounded-lg px-3 py-1.5 border border-brand-line">
          {listening ? 'Escuchando: ' : 'Escuché: '}
          <span className="font-semibold not-italic text-brand-ink">&ldquo;{heard}&rdquo;</span>
        </div>
      )}

      {/* Botones de confirmación ("Sí, continuar" / "Corregir") */}
      {phase === 'confirm' && (
        <div className="flex gap-2 mt-2.5 pt-2 border-t border-brand-line/60">
          <button
            type="button"
            onClick={onConfirmYes}
            className="flex-1 py-2 px-3 rounded-lg bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs sm:text-sm cursor-pointer shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            Sí, continuar &rarr;
          </button>
          <button
            type="button"
            onClick={onConfirmNo}
            className="flex-1 py-2 px-3 rounded-lg border border-brand-line bg-white hover:border-brand-accent text-gray-700 font-semibold text-xs sm:text-sm cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            Corregir
          </button>
        </div>
      )}

      {/* Modo escritura simulada / teclado fallback */}
      {sim && (
        <form onSubmit={handleSimSubmit} className="flex gap-2 mt-2.5 pt-2 border-t border-brand-line/60">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Escribí lo que dirías… (ej: perro mediano)"
            className="flex-1 px-3 py-1.5 rounded-lg border border-brand-line text-xs sm:text-sm bg-white text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            aria-label="Respuesta escrita para el asistente"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs sm:text-sm cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            Enviar
          </button>
        </form>
      )}

      {/* Barra de opciones inferiores (Escribir en vez de hablar + Leer en voz alta) */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-1 text-[11px] text-gray-700">
        {supported ? (
          <button
            type="button"
            onClick={onToggleSim}
            className="text-brand-accent font-semibold underline hover:text-brand-accent/80 cursor-pointer focus-visible:outline-none"
          >
            {sim ? 'Ocultar escritura' : 'Escribir en vez de hablar'}
          </button>
        ) : (
          <span className="text-gray-700">Reconocimiento no disponible</span>
        )}

        {typeof window !== 'undefined' && 'speechSynthesis' in window && (
          <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium select-none text-gray-700">
            <input
              type="checkbox"
              checked={tts}
              onChange={(e) => onToggleTts(e.target.checked)}
              className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent w-3.5 h-3.5"
            />
            <span>Leer en voz alta</span>
          </label>
        )}
      </div>
    </div>
  );
}
