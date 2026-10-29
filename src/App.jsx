import React, { useState, useEffect } from 'react';
import PublicWizard from './components/PublicWizard';
import AdminPanel from './components/AdminPanel';
import { supabase } from './lib/supabase';
import { FaPaw } from 'react-icons/fa6';
import { FiUserCheck, FiLock, FiRotateCcw } from 'react-icons/fi';

const LOCAL_USER_STORAGE_KEY = 'match_responsable_active_user';

const STEP_META = {
  step1: { n: 1, label: 'Paso 1 de 4 · Selección de mascota' },
  step2: { n: 2, label: 'Paso 2 de 4 · Espacio, presupuesto y tiempo' },
  step3: { n: 3, label: 'Paso 3 de 4 · Experiencia y dudas' },
};

export default function App() {
  const [viewMode, setViewMode] = useState('public');
  const [history, setHistory] = useState(['welcome']);

  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
      return saved ? { user: JSON.parse(saved) } : null;
    } catch (_e) {
      return null;
    }
  });

  useEffect(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('match_responsable_theme');

    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session?.user) {
        const u = data.session.user;
        const { data: dbUser } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', u.id)
          .maybeSingle();

        const cleanEmail = u.email?.trim().toLowerCase();
        const isAdmin = Boolean(
          dbUser?.is_admin ||
          dbUser?.rol === 'admin' ||
          u.user_metadata?.is_admin ||
          u.user_metadata?.role === 'admin' ||
          cleanEmail === 'admin@gmail.com'
        );

        const fullUser = {
          ...u,
          is_admin: isAdmin,
          rol: isAdmin ? 'admin' : (dbUser?.rol || 'refugio'),
          nombre_refugio: dbUser?.nombre_refugio || u.user_metadata?.nombre_refugio || u.email,
          telefono: dbUser?.telefono || '',
          correo_contacto: dbUser?.correo_contacto || dbUser?.email || u.email || '',
          redes_sociales: dbUser?.redes_sociales || '',
          direccion: dbUser?.direccion || '',
        };

        localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(fullUser));
        setSession({ user: fullUser });
      }
    });
  }, []);

  function handleActivateSession(userObj) {
    localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(userObj));
    setSession({ user: userObj });
    setViewMode('admin');
  }

  async function handleLogout() {
    localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
    await supabase.auth.signOut();
    setSession(null);
    setViewMode('public');
  }

  const currentScreen = history[history.length - 1] || 'welcome';

  function navigateTo(screenName, push = true) {
    setHistory((prev) => {
      if (push) {
        return [...prev, screenName];
      }
      const copy = [...prev];
      copy[copy.length - 1] = screenName;
      return copy;
    });
  }

  function goBack() {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  function resetHistoryToWelcome() {
    setHistory(['welcome']);
  }

  const showBackBtn =
    viewMode === 'public' &&
    !['welcome', 'loading', 'contactoOk', 'confirmacion'].includes(currentScreen) &&
    history.length > 1;

  const isNumberedStep = viewMode === 'public' && Boolean(STEP_META[currentScreen]);

  let stepLabel = '';
  if (viewMode === 'admin') {
    stepLabel = session ? 'Panel Administrativo' : 'Iniciar sesión / Registrarse';
  } else if (STEP_META[currentScreen]) {
    stepLabel = STEP_META[currentScreen].label;
  } else if (['result', 'fuentes', 'detalle', 'contacto'].includes(currentScreen)) {
    stepLabel = {
      result: 'Paso 4 de 4 · Resultados de compatibilidad',
      fuentes: 'Directorio de fuentes confiables',
      detalle: 'Detalle de fuentes confiables',
      contacto: 'Contactar un refugio',
    }[currentScreen];
  } else if (currentScreen === 'contactoOk') {
    stepLabel = 'Consulta enviada';
  } else if (currentScreen === 'confirmacion') {
    stepLabel = 'Resumen guardado';
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink flex flex-col">
      {/* Barra de navegación superior */}
      <header className="bg-brand-accent text-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setViewMode('public');
                resetHistoryToWelcome();
              }}
              className="flex items-center gap-2 text-left rounded-lg py-1 px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            >
              <span
                className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <FaPaw className="w-4 h-4 text-white" />
              </span>
              <div>
                <span className="text-base sm:text-lg font-bold tracking-tight block leading-none">
                  Match Responsable
                </span>
                <span className="text-[11px] text-white/90 hidden sm:block mt-0.5">
                  Adopción consciente y emparejamiento de mascotas
                </span>
              </div>
            </button>
          </div>

          <nav
            className="flex items-center gap-1.5 bg-black/15 p-1 rounded-xl"
            aria-label="Navegación principal"
          >
            <button
              type="button"
              onClick={() => setViewMode('public')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                viewMode === 'public'
                  ? 'bg-white text-brand-accent shadow-sm'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <FiUserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Evaluación Adoptante</span>
            </button>

            {session ? (
              <button
                type="button"
                onClick={() => setViewMode('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  viewMode === 'admin'
                    ? 'bg-white text-brand-accent shadow-sm'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <FiLock className="w-3.5 h-3.5 shrink-0" />
                <span>{session.user?.is_admin ? 'Panel Administrativo' : 'Gestión de Mascotas'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setViewMode('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  viewMode === 'admin'
                    ? 'bg-white text-brand-accent shadow-sm'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <FiLock className="w-3.5 h-3.5 shrink-0" />
                <span>Iniciar sesión / Registrarse</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Contenedor principal responsive */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 flex flex-col">
        {/* Subbarra de navegación y progreso cuando el usuario está dentro del flujo */}
        {viewMode === 'public' && !['welcome', 'loading', 'fuentes', 'detalle'].includes(currentScreen) && (
          <div className="mb-3 bg-brand-surface border border-brand-line rounded-xl px-4 py-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs sm:text-sm font-bold text-brand-ink">{stepLabel}</span>

              {currentScreen !== 'welcome' && (
                <button
                  type="button"
                  onClick={resetHistoryToWelcome}
                  className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs cursor-pointer transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  title="Reiniciar cuestionario"
                >
                  <FiRotateCcw className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  <span>Reiniciar</span>
                </button>
              )}
            </div>

            {isNumberedStep && (
              <div
                className="grid grid-cols-4 gap-1.5 mt-2"
                role="progressbar"
                aria-valuenow={STEP_META[currentScreen].n}
                aria-valuemin={1}
                aria-valuemax={4}
                aria-label={STEP_META[currentScreen].label}
              >
                {[1, 2, 3, 4].map((stepNum) => (
                  <div
                    key={stepNum}
                    className={`h-1.5 rounded-full transition-colors ${
                      stepNum <= STEP_META[currentScreen].n ? 'bg-brand-accent' : 'bg-brand-line'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contenido de la vista activa */}
        {viewMode === 'admin' ? (
          <AdminPanel
            session={session}
            onActivateSession={handleActivateSession}
            onLogout={handleLogout}
            onBackToPublic={() => setViewMode('public')}
          />
        ) : (
          <PublicWizard
            screen={currentScreen}
            navigateTo={navigateTo}
            goBack={goBack}
            canGoBack={history.length > 1}
            resetHistoryToWelcome={resetHistoryToWelcome}
          />
        )}
      </main>

      {/* Pie de página */}
      <footer className="w-full border-t border-brand-line bg-white/70 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center text-xs text-gray-700">
          <span>
            <strong>Match Responsable</strong> · Plataforma de adopción consciente y emparejamiento responsable
          </span>
        </div>
      </footer>
    </div>
  );
}
