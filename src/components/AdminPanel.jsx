import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import { formatColones } from '../utils/matchLogic';
import AdminResourcesManager from './AdminResourcesManager';
import {
  FiEye,
  FiEyeOff,
  FiLogOut,
  FiUploadCloud,
  FiList,
  FiPower,
  FiTrash2,
  FiX,
  FiCheckCircle,
  FiPhone,
  FiMail,
  FiExternalLink,
  FiMapPin,
  FiAlertCircle,
} from 'react-icons/fi';
import {
  FaHouse,
  FaStethoscope,
  FaBookOpen,
  FaPaw,
} from 'react-icons/fa6';

export default function AdminPanel({
  session,
  onActivateSession,
  onLogout,
  onBackToPublic,
}) {
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [confirmModal, setConfirmModal] = useState(null);
  const [expandedImage, setExpandedImage] = useState(null);

  const [activeTab, setActiveTab] = useState(() => (session?.user?.is_admin ? 'refugios' : 'nuevo'));

  useEffect(() => {
    if (session?.user?.is_admin) {
      setActiveTab('refugios');
    } else {
      setActiveTab('nuevo');
    }
  }, [session?.user?.id, session?.user?.is_admin]);

  const [mascotas, setMascotas] = useState([]);
  const [loadingPets, setLoadingPets] = useState(false);
  const [petMessage, setPetMessage] = useState({ type: '', text: '' });
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const {
    register: registerAuth,
    handleSubmit: handleSubmitAuth,
    formState: { errors: authErrors },
    reset: resetAuthForm,
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
      nombre_refugio: '',
    },
  });

  const {
    register: registerPet,
    handleSubmit: handleSubmitPet,
    setValue: setPetValue,
    watch: watchPet,
    reset: resetPetForm,
    formState: { errors: petErrors, isSubmitting: isSavingPet },
  } = useForm({
    defaultValues: {
      nombre: '',
      tipo: 'Perro',
      tamano: 'Mediano',
      apto_apartamento: true,
      horas_minimas_atencion: 2,
      costo_mensual_estimado: 45000,
    },
  });

  const watchedTipo = watchPet('tipo');
  const watchedTamano = watchPet('tamano');
  const watchedApto = watchPet('apto_apartamento');

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setPetMessage({
          type: 'warn',
          text: 'La imagen supera los 5MB. Por favor seleccioná una imagen más liviana.',
        });
        return;
      }
      setSelectedImageFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
    }
  }

  function handleRemoveImage() {
    setSelectedImageFile(null);
    setImagePreview('');
  }

  const [userProfile, setUserProfile] = useState(() => ({
    nombre_refugio: session?.user?.nombre_refugio || '',
    telefono: session?.user?.telefono || '',
    correo_contacto: session?.user?.correo_contacto || session?.user?.email || '',
    redes_sociales: session?.user?.redes_sociales || '',
    direccion: session?.user?.direccion || '',
  }));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

  const {
    register: registerContact,
    handleSubmit: handleSubmitContact,
    formState: { errors: contactErrors },
    reset: resetContactForm,
  } = useForm({
    defaultValues: {
      nombre_refugio: session?.user?.nombre_refugio || '',
      telefono: session?.user?.telefono || '',
      correo_contacto: session?.user?.correo_contacto || session?.user?.email || '',
      redes_sociales: session?.user?.redes_sociales || '',
      direccion: session?.user?.direccion || '',
    },
  });

  useEffect(() => {
    if (session?.user?.id) {
      supabase
        .from('usuarios')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) {
            const p = {
              nombre_refugio: data.nombre_refugio || session.user.nombre_refugio || '',
              telefono: data.telefono || '',
              correo_contacto: data.correo_contacto || data.email || session.user.email || '',
              redes_sociales: data.redes_sociales || '',
              direccion: data.direccion || '',
            };
            setUserProfile(p);
            resetContactForm(p);
          }
        });
    }
  }, [session?.user?.id]);

  const hasContactInfo = Boolean(
    userProfile.telefono?.trim() &&
    (userProfile.correo_contacto?.trim() || session?.user?.email)
  );

  async function onContactSubmit(values) {
    setProfileMessage({ type: '', text: '' });
    setSavingProfile(true);
    try {
      const payload = {
        nombre_refugio: values.nombre_refugio.trim(),
        telefono: values.telefono.trim(),
        correo_contacto: values.correo_contacto.trim().toLowerCase(),
        redes_sociales: values.redes_sociales?.trim() || '',
        direccion: values.direccion?.trim() || '',
      };

      const { error } = await supabase
        .from('usuarios')
        .update(payload)
        .eq('id', session.user.id);

      if (error) throw error;

      setUserProfile(payload);
      const updatedUser = {
        ...session.user,
        ...payload,
      };
      onActivateSession(updatedUser);

      setProfileMessage({
        type: 'ok',
        text: '¡Información de contacto guardada! Ya podés publicar mascotas en adopción.',
      });
      setTimeout(() => {
        setProfileMessage({ type: '', text: '' });
      }, 3500);

      if (!hasContactInfo && activeTab === 'contacto') {
        setActiveTab('nuevo');
      }
    } catch (err) {
      setProfileMessage({
        type: 'warn',
        text: `Error al guardar los datos de contacto: ${err.message}`,
      });
    } finally {
      setSavingProfile(false);
    }
  }

  useEffect(() => {
    if (session && !session.user?.is_admin) {
      fetchMascotas();
    }
  }, [session]);

  async function fetchMascotas() {
    if (!session?.user?.id) return;
    setLoadingPets(true);
    try {
      let query = supabase
        .from('mascotas')
        .select('*')
        .order('created_at', { ascending: false });

      if (!session.user.is_admin) {
        query = query.eq('creado_por', session.user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMascotas(data || []);
    } catch (err) {
      setPetMessage({
        type: 'warn',
        text: `No se pudieron cargar tus mascotas registradas: ${err.message}`,
      });
    } finally {
      setLoadingPets(false);
    }
  }

  async function onAuthSubmit(values) {
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    const cleanEmail = values.email.trim().toLowerCase();
    const refugioName = values.nombre_refugio?.trim() || cleanEmail.split('@')[0];

    try {
      if (authMode === 'login') {
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: values.password,
        });

        if (signInError || !authData?.user) {
          if (
            signInError?.message?.toLowerCase().includes('invalid login credentials') ||
            signInError?.status === 400
          ) {
            setAuthError('El correo y la contraseña no coinciden');
          } else {
            setAuthError(signInError?.message || 'El correo y la contraseña no coinciden');
          }
          return;
        }

        const { data: dbUser } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        const isAdmin = Boolean(
          dbUser?.is_admin ||
          dbUser?.rol === 'admin' ||
          authData.user.user_metadata?.is_admin ||
          authData.user.user_metadata?.role === 'admin' ||
          cleanEmail === 'admin@gmail.com'
        );

        const userObj = {
          ...authData.user,
          is_admin: isAdmin,
          rol: isAdmin ? 'admin' : (dbUser?.rol || 'refugio'),
          nombre_refugio: dbUser?.nombre_refugio || authData.user.user_metadata?.nombre_refugio || cleanEmail,
          telefono: dbUser?.telefono || '',
          correo_contacto: dbUser?.correo_contacto || dbUser?.email || cleanEmail,
          redes_sociales: dbUser?.redes_sociales || '',
          direccion: dbUser?.direccion || '',
        };

        onActivateSession(userObj);
        resetAuthForm();
        return;
      } else {
        const { data: rpcData, error: rpcError } = await supabase.rpc('register_user', {
          p_email: cleanEmail,
          p_password: values.password,
          p_nombre_refugio: refugioName,
        });

        if (rpcData && rpcData.success === false) {
          throw new Error(rpcData.error || 'No se pudo registrar el usuario.');
        }

        if (rpcError) {
          const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password: values.password,
            options: {
              data: {
                nombre_refugio: refugioName,
                is_admin: false,
                role: 'refugio',
              },
            },
          });

          if (error) {
            if (error.message?.includes('is invalid') || error.code === 'email_address_invalid') {
              throw new Error(
                'Supabase rechazó el envío del correo de confirmación. En tu consola de Supabase, ve a Authentication > Providers > Email y desactiva la opción "Confirm email".'
              );
            }
            throw error;
          }
        }

        setAuthMode('login');
        setAuthSuccess('¡Cuenta creada exitosamente! Por favor ingresá tu contraseña para iniciar sesión.');
        resetAuthForm({
          email: cleanEmail,
          password: '',
          nombre_refugio: '',
        });
        return;
      }
    } catch (err) {
      setAuthError(err.message || 'No se pudo completar el acceso.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function onPetSubmit(values) {
    setPetMessage({ type: '', text: '' });
    setIsUploadingImage(true);
    try {
      let finalImageUrl = null;

      if (selectedImageFile) {
        const fileExt = selectedImageFile.name.split('.').pop() || 'jpg';
        const safeBase = selectedImageFile.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15);
        const fileName = `${Date.now()}_${safeBase}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('mascotas')
          .upload(fileName, selectedImageFile, {
            contentType: selectedImageFile.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Error al subir la imagen: ${uploadError.message}`);
        }

        const { data: pubData } = supabase.storage
          .from('mascotas')
          .getPublicUrl(fileName);

        finalImageUrl = pubData?.publicUrl || null;
      }

      const payload = {
        nombre: values.nombre.trim(),
        tipo: values.tipo,
        tamano: values.tamano,
        apto_apartamento: Boolean(values.apto_apartamento),
        horas_minimas_atencion: Number(values.horas_minimas_atencion),
        costo_mensual_estimado: Number(values.costo_mensual_estimado),
        imagen_url: finalImageUrl,
        creado_por: session?.user?.id || null,
        estado: 'activa',
      };

      const { data, error } = await supabase
        .from('mascotas')
        .insert([payload])
        .select();

      if (error) throw error;

      setPetMessage({
        type: 'ok',
        text: `¡Mascota "${payload.nombre}" registrada correctamente!`,
      });
      setTimeout(() => {
        setPetMessage({ type: '', text: '' });
      }, 3000);

      handleRemoveImage();
      resetPetForm({
        nombre: '',
        tipo: 'Perro',
        tamano: 'Mediano',
        apto_apartamento: true,
        horas_minimas_atencion: 2,
        costo_mensual_estimado: 45000,
      });

      if (data && data.length > 0) {
        setMascotas((prev) => [data[0], ...prev]);
      } else {
        fetchMascotas();
      }

      setActiveTab('listado');
    } catch (err) {
      setPetMessage({
        type: 'warn',
        text: `Error al registrar la mascota: ${err.message}`,
      });
      setTimeout(() => {
        setPetMessage({ type: '', text: '' });
      }, 3500);
    } finally {
      setIsUploadingImage(false);
    }
  }

  function promptTogglePetStatus(m) {
    const isActiva = m.estado === 'activa';
    const nextEstado = isActiva ? 'inactiva' : 'activa';
    const accion = isActiva ? 'desactivar' : 'activar';
    setConfirmModal({
      type: 'toggle',
      id: m.id,
      name: m.nombre,
      action: accion,
      nextEstado,
    });
  }

  function promptDeletePet(id, nombre) {
    setConfirmModal({
      type: 'delete',
      id,
      name: nombre,
      action: 'eliminar',
    });
  }

  async function executePetConfirmAction() {
    if (!confirmModal) return;
    const { type, id, name, nextEstado } = confirmModal;
    setConfirmModal(null);

    try {
      if (type === 'toggle') {
        let query = supabase
          .from('mascotas')
          .update({ estado: nextEstado })
          .eq('id', id);

        if (!session.user?.is_admin) {
          query = query.eq('creado_por', session.user.id);
        }

        const { error } = await query;

        if (error) throw error;

        setMascotas((prev) =>
          prev.map((m) => (m.id === id ? { ...m, estado: nextEstado } : m))
        );

        setPetMessage({
          type: 'ok',
          text: `¡Mascota "${name}" marcada como ${nextEstado === 'activa' ? 'Activa (disponible)' : 'Inactiva (adoptada)'}!`,
        });
        setTimeout(() => {
          setPetMessage({ type: '', text: '' });
        }, 3000);
      } else if (type === 'delete') {
        let query = supabase.from('mascotas').delete().eq('id', id);

        if (!session.user?.is_admin) {
          query = query.eq('creado_por', session.user.id);
        }

        const { error } = await query;
        if (error) throw error;
        setMascotas((prev) => prev.filter((m) => m.id !== id));
        setPetMessage({
          type: 'ok',
          text: `¡Mascota "${name}" eliminada correctamente!`,
        });
        setTimeout(() => {
          setPetMessage({ type: '', text: '' });
        }, 3000);
      }
    } catch (err) {
      setPetMessage({
        type: 'warn',
        text: `Error al procesar: ${err.message}`,
      });
      setTimeout(() => {
        setPetMessage({ type: '', text: '' });
      }, 3500);
    }
  }

  function renderContactForm() {
    return (
      <form onSubmit={handleSubmitContact(onContactSubmit)} className="flex flex-col gap-4" noValidate>
        {profileMessage.text && (
          <div
            role="status"
            className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fade-in ${
              profileMessage.type === 'ok'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-brand-err-line bg-brand-err-tint text-brand-err-ink'
            }`}
          >
            {profileMessage.type === 'ok' ? (
              <FiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <FiAlertCircle className="w-4 h-4 text-brand-err-ink shrink-0" />
            )}
            <span>{profileMessage.text}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Tu nombre completo o nombre del refugio / albergue *
          </label>
          <input
            type="text"
            placeholder="Ej. Albergue Animales Felices / Juan Pérez"
            {...registerContact('nombre_refugio', { required: 'Ingresá tu nombre o el del refugio.' })}
            className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent bg-brand-surface ${
              contactErrors.nombre_refugio ? 'border-brand-err-line' : 'border-brand-line'
            }`}
          />
          {contactErrors.nombre_refugio && (
            <span className="text-xs text-brand-err-ink font-semibold mt-1 block">
              {contactErrors.nombre_refugio.message}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Teléfono o WhatsApp de contacto *
            </label>
            <input
              type="tel"
              placeholder="Ej. 8888-8888 o 2222-3333"
              {...registerContact('telefono', {
                required: 'Ingresá un número telefónico de contacto.',
                minLength: { value: 8, message: 'Ingresá al menos 8 dígitos.' },
              })}
              className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent bg-brand-surface ${
                contactErrors.telefono ? 'border-brand-err-line' : 'border-brand-line'
              }`}
            />
            {contactErrors.telefono && (
              <span className="text-xs text-brand-err-ink font-semibold mt-1 block">
                {contactErrors.telefono.message}
              </span>
            )}
            <span className="text-[11px] text-gray-500 mt-1 block">
              Será el teléfono donde te llamarán o escribirán por WhatsApp los adoptantes interesados.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Correo electrónico para adopciones *
            </label>
            <input
              type="email"
              placeholder="Ej. contacto@refugio.org"
              {...registerContact('correo_contacto', {
                required: 'Ingresá un correo de contacto.',
              })}
              className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent bg-brand-surface ${
                contactErrors.correo_contacto ? 'border-brand-err-line' : 'border-brand-line'
              }`}
            />
            {contactErrors.correo_contacto && (
              <span className="text-xs text-brand-err-ink font-semibold mt-1 block">
                {contactErrors.correo_contacto.message}
              </span>
            )}
            <span className="text-[11px] text-gray-500 mt-1 block">
              Donde recibirás consultas de adoptantes que hicieron match con tus mascotas.
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-0.5">
            Redes sociales o página web
          </label>
          <span className="block text-[11px] font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 mb-1.5">
            Nota: Colocá enlaces de redes o sitio del refugio / albergue al que pertenecés (<strong>NO redes personales</strong>).
          </span>
          <input
            type="text"
            placeholder="Ej. https://facebook.com/refugio o https://instagram.com/refugio"
            {...registerContact('redes_sociales')}
            className="w-full px-3.5 py-2.5 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent bg-brand-surface"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Ubicación / Dirección (Provincia o cantón)
          </label>
          <input
            type="text"
            placeholder="Ej. San José, Santa Ana"
            {...registerContact('direccion')}
            className="w-full px-3.5 py-2.5 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent bg-brand-surface"
          />
          <span className="text-[11px] text-gray-500 mt-0.5 block">
            Permite a los adoptantes saber en qué zona se ubican tus mascotas.
          </span>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={savingProfile}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {savingProfile ? 'Guardando…' : 'Guardar información de contacto'}
          </button>
        </div>
      </form>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* VISTA: LOGIN / REGISTRO CUANDO NO HAY SESIÓN INICIADA                      */
  /* -------------------------------------------------------------------------- */
  if (!session) {
    return (
      <section className="bg-brand-surface border border-brand-line rounded-3xl p-6 sm:p-10 shadow-sm max-w-xl mx-auto w-full my-auto">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
          Personas Particulares, Rescatistas y Refugios
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-brand-ink mb-2">
          {authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta para dar en adopción'}
        </h1>
        <p className="text-sm sm:text-base text-gray-700 mb-6 leading-relaxed">
          Tanto si sos una persona particular que busca un hogar responsable para una mascota como si
          representás a un refugio o albergue, ingresá o registrate para publicar mascotas en adopción.
        </p>

        {/* Selector accesible por teclado entre Login y Registro */}
        <div
          className="grid grid-cols-2 gap-3 mb-6"
          role="tablist"
          aria-label="Modo de acceso"
        >
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'login'}
            onClick={() => {
              setAuthMode('login');
              setAuthError('');
              setAuthSuccess('');
            }}
            className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-1 ${
              authMode === 'login'
                ? 'border-brand-accent bg-brand-accent-tint text-brand-ink'
                : 'border-brand-line bg-brand-surface text-gray-700'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'register'}
            onClick={() => {
              setAuthMode('register');
              setAuthError('');
              setAuthSuccess('');
            }}
            className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-1 ${
              authMode === 'register'
                ? 'border-brand-accent bg-brand-accent-tint text-brand-ink'
                : 'border-brand-line bg-brand-surface text-gray-700'
            }`}
          >
            Registrarse
          </button>
        </div>

        <form onSubmit={handleSubmitAuth(onAuthSubmit)} className="flex flex-col gap-4" noValidate>
          {authMode === 'register' && (
            <div>
              <label
                htmlFor="nombre_refugio"
                className="block text-sm font-bold text-gray-700 mb-1.5"
              >
                Tu nombre completo o nombre del refugio
              </label>
              <input
                id="nombre_refugio"
                type="text"
                placeholder="Ej. Andrea Vargas o Albergue Santa Cruz"
                {...registerAuth('nombre_refugio')}
                className="w-full px-4 py-3 rounded-xl border-2 border-brand-line text-sm sm:text-base text-brand-ink bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              />
              <p className="text-xs text-gray-700 mt-1">
                Podés registrarte como persona particular, rescatista independiente o refugio.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="auth_email" className="block text-sm font-bold text-gray-700 mb-1.5">
              Correo electrónico
            </label>
            <input
              id="auth_email"
              type="email"
              placeholder="correo@ejemplo.com"
              {...registerAuth('email', {
                required: 'Ingresá tu correo electrónico.',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Formato de correo inválido.',
                },
              })}
              className={`w-full px-4 py-3 rounded-xl border-2 text-sm sm:text-base text-brand-ink bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                authErrors.email ? 'border-brand-err-line' : 'border-brand-line'
              }`}
            />
            {authErrors.email && (
              <p className="text-xs font-semibold text-brand-err-ink mt-1.5" role="alert">
                {authErrors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="auth_password"
              className="block text-sm font-bold text-gray-700 mb-1.5"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="auth_password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                {...registerAuth('password', {
                  required: 'Ingresá tu contraseña.',
                  minLength: {
                    value: 6,
                    message: 'La contraseña debe tener al menos 6 caracteres.',
                  },
                })}
                className={`w-full px-4 py-3 pr-11 rounded-xl border-2 text-sm sm:text-base text-brand-ink bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                  authErrors.password ? 'border-brand-err-line' : 'border-brand-line'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-brand-accent p-1.5 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? (
                  <FiEyeOff className="w-5 h-5" />
                ) : (
                  <FiEye className="w-5 h-5" />
                )}
              </button>
            </div>
            {authErrors.password && (
              <p className="text-xs font-semibold text-brand-err-ink mt-1.5" role="alert">
                {authErrors.password.message}
              </p>
            )}
          </div>

          {authSuccess && (
            <div
              role="status"
              className="p-3.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 text-xs sm:text-sm font-semibold text-emerald-800 flex items-center gap-2 animate-fade-in"
            >
              <FiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          {authError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border-2 border-brand-err-line bg-brand-err-tint text-xs sm:text-sm font-medium text-brand-err-ink"
            >
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="mt-2 w-full py-3.5 rounded-xl bg-brand-accent text-white font-bold text-base cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
          >
            {authLoading
              ? 'Ingresando…'
              : authMode === 'login'
              ? 'Iniciar sesión'
              : 'Crear cuenta y continuar'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-brand-line">
          <button
            type="button"
            onClick={onBackToPublic}
            className="w-full py-3 rounded-xl border-2 border-brand-line hover:border-brand-accent text-brand-ink font-semibold text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            &larr; Volver a la evaluación de adoptantes
          </button>
        </div>
      </section>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* VISTA PRINCIPAL: PANEL CON PESTAÑAS (FORMULARIO Y LISTADO)                 */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="flex flex-col gap-3.5 w-full max-w-4xl mx-auto">
      {/* Cabecera de sesión activa */}
      <div className="bg-brand-surface border border-brand-line rounded-xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">
              {session.user.is_admin ? 'Panel de Control Maestro' : 'Panel de Gestión de Adopciones'}
            </span>
            {session.user.is_admin && (
              <span className="bg-brand-accent text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                ADMINISTRADOR
              </span>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-brand-ink">
            {session.user.is_admin ? 'Administración General del Sistema' : 'Administrar Mascotas'}
          </h1>
          <p className="text-xs text-gray-700">
            Usuario:{' '}
            <strong className="text-brand-ink">
              {session.user.nombre_refugio
                ? `${session.user.nombre_refugio} (${session.user.email})`
                : session.user.email}
            </strong>
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 flex items-center gap-1.5"
        >
          <FiLogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {/* Selector de pestañas */}
      {session.user.is_admin ? (
        <div
          className="flex items-center gap-1.5 bg-brand-surface border border-brand-line p-1 rounded-xl shadow-sm"
          role="tablist"
          aria-label="Pestañas de administración"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'refugios'}
            onClick={() => setActiveTab('refugios')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
              activeTab === 'refugios'
                ? 'bg-brand-accent text-white shadow-sm'
                : 'text-gray-700 hover:bg-brand-bg/60'
            }`}
          >
            <FaHouse className="w-3.5 h-3.5 shrink-0" />
            <span>Refugios Verificados</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'veterinarios'}
            onClick={() => setActiveTab('veterinarios')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
              activeTab === 'veterinarios'
                ? 'bg-brand-accent text-white shadow-sm'
                : 'text-gray-700 hover:bg-brand-bg/60'
            }`}
          >
            <FaStethoscope className="w-3.5 h-3.5 shrink-0" />
            <span>Veterinarios</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'guias'}
            onClick={() => setActiveTab('guias')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
              activeTab === 'guias'
                ? 'bg-brand-accent text-white shadow-sm'
                : 'text-gray-700 hover:bg-brand-bg/60'
            }`}
          >
            <FaBookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Guías de Cuidado</span>
          </button>
        </div>
      ) : (
        <div
          className="flex items-center gap-1.5 bg-brand-surface border border-brand-line p-1 rounded-xl shadow-sm"
          role="tablist"
          aria-label="Pestañas del panel"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'nuevo'}
            onClick={() => setActiveTab('nuevo')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
              activeTab === 'nuevo'
                ? 'bg-brand-accent text-white shadow-sm'
                : 'text-gray-700 hover:bg-brand-bg/60'
            }`}
          >
            <FaPaw className="w-3.5 h-3.5 shrink-0" />
            <span>Nueva mascota</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'listado'}
            onClick={() => setActiveTab('listado')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
              activeTab === 'listado'
                ? 'bg-brand-accent text-white shadow-sm'
                : 'text-gray-700 hover:bg-brand-bg/60'
            }`}
          >
            <FiList className="w-3.5 h-3.5 shrink-0" />
            <span>Mis mascotas ({mascotas.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'contacto'}
            onClick={() => setActiveTab('contacto')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent relative ${
              activeTab === 'contacto'
                ? 'bg-brand-accent text-white shadow-sm'
                : 'text-gray-700 hover:bg-brand-bg/60'
            }`}
          >
            <FiPhone className="w-3.5 h-3.5 shrink-0" />
            <span>Datos de contacto</span>
            {!hasContactInfo && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Información requerida" />
            )}
          </button>
        </div>
      )}

      {/* VISTA EXCLUSIVA DEL ADMINISTRADOR (Refugios, Veterinarios, Guías con modal) */}
      {session.user.is_admin ? (
        <AdminResourcesManager currentTab={activeTab} />
      ) : (
        <>
          {petMessage.text && (
            <div
              role="status"
              className={`p-3 rounded-xl border text-xs sm:text-sm font-medium transition animate-fade-in ${
                petMessage.type === 'ok'
                  ? 'border-brand-accent bg-brand-accent-tint text-brand-ink'
                  : 'border-brand-warn-line bg-brand-warn-tint text-brand-warn-ink'
              }`}
            >
              {petMessage.text}
            </div>
          )}

      {/* PESTAÑA 1: NUEVA MASCOTA O COMPLETAR DATOS DE CONTACTO */}
      {activeTab === 'nuevo' && !hasContactInfo && (
        <section className="bg-brand-surface border-2 border-brand-accent/40 rounded-2xl p-4 sm:p-6 shadow-sm w-full animate-fade-in">
          <div className="flex items-start gap-3 mb-5 pb-4 border-b border-brand-line">
            <div className="w-10 h-10 rounded-xl bg-brand-accent-tint flex items-center justify-center text-brand-accent shrink-0">
              <FiPhone className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-1.5 border border-amber-300">
                <FiAlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Paso previo requerido</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-brand-ink">
                Completá tu información de contacto para adopciones
              </h2>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mt-1">
                Antes de poder publicar una mascota en adopción, debés ingresar tus datos de contacto. Cuando una persona haga match con tus mascotas, verá esta información para comunicarse directamente con vos o tu refugio.
              </p>
            </div>
          </div>

          {renderContactForm()}
        </section>
      )}

      {activeTab === 'nuevo' && hasContactInfo && (
        <section className="bg-brand-surface border border-brand-line rounded-2xl p-4 sm:p-6 shadow-sm w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-brand-line">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-brand-ink">
                Registrar mascota en adopción
              </h2>
              <p className="text-xs sm:text-sm text-gray-700">
                Completá los datos reales para el emparejamiento con adoptantes ideales.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600 bg-brand-bg/60 px-3 py-1.5 rounded-xl border border-brand-line self-start sm:self-auto">
              <FiPhone className="w-3.5 h-3.5 text-brand-accent shrink-0" />
              <span className="truncate max-w-[200px]">
                {userProfile.nombre_refugio} ({userProfile.telefono})
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('contacto')}
                className="text-brand-accent font-bold hover:underline cursor-pointer ml-1"
              >
                Editar
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmitPet(onPetSubmit)} className="flex flex-col gap-4" noValidate>
            {/* Sección 1: Información básica */}
            <div className="bg-brand-bg/30 border border-brand-line rounded-xl p-3.5 sm:p-4 flex flex-col gap-3.5">
              <h3 className="text-sm font-bold text-brand-ink border-b border-brand-line pb-1.5">
                1. Información básica
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="pet_nombre" className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">
                    Nombre de la mascota *
                  </label>
                  <input
                    id="pet_nombre"
                    type="text"
                    placeholder="Ej. Luna, Max..."
                    {...registerPet('nombre', {
                      required: 'El nombre de la mascota es obligatorio.',
                    })}
                    className={`w-full px-3 py-2 rounded-lg border text-sm text-brand-ink bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                      petErrors.nombre ? 'border-brand-err-line' : 'border-brand-line'
                    }`}
                  />
                  {petErrors.nombre && (
                    <p className="text-xs font-semibold text-brand-err-ink mt-1" role="alert">
                      {petErrors.nombre.message}
                    </p>
                  )}
                </div>

                <div>
                  <span className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">
                    Tipo de animal *
                  </span>
                  <div
                    className="grid grid-cols-3 gap-2"
                    role="radiogroup"
                    aria-label="Tipo de mascota"
                  >
                    {['Perro', 'Gato', 'Otro'].map((tipoOption) => {
                      const selected = watchedTipo === tipoOption;
                      return (
                        <button
                          key={tipoOption}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setPetValue('tipo', tipoOption, { shouldValidate: true })}
                          className={`py-2 px-1 rounded-lg text-xs font-bold border transition cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                            selected
                              ? 'border-brand-accent bg-brand-accent-tint text-brand-ink'
                              : 'border-brand-line bg-brand-surface text-gray-700'
                          }`}
                        >
                          {tipoOption}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <span className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">
                  Tamaño de la mascota *
                </span>
                <div
                  className="grid grid-cols-3 gap-2"
                  role="radiogroup"
                  aria-label="Tamaño de la mascota"
                >
                  {['Pequeño', 'Mediano', 'Grande'].map((tamOption) => {
                    const selected = watchedTamano === tamOption;
                    return (
                      <button
                        key={tamOption}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPetValue('tamano', tamOption, { shouldValidate: true })}
                        className={`py-2 px-2 rounded-lg text-xs font-bold border transition cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                          selected
                            ? 'border-brand-accent bg-brand-accent-tint text-brand-ink'
                            : 'border-brand-line bg-brand-surface text-gray-700'
                        }`}
                      >
                        {tamOption}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sección 2: Fotografía */}
            <div className="bg-brand-bg/30 border border-brand-line rounded-xl p-3.5 sm:p-4 flex flex-col gap-3">
              <h3 className="text-sm font-bold text-brand-ink border-b border-brand-line pb-1.5">
                2. Fotografía de la mascota
              </h3>

              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-brand-accent bg-brand-surface p-3 flex flex-col sm:flex-row items-center gap-3">
                  <img
                    src={imagePreview}
                    alt="Vista previa de la mascota"
                    className="w-20 h-20 object-cover rounded-lg border border-brand-line flex-shrink-0"
                  />
                  <div className="flex-1 text-center sm:text-left min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-brand-ink truncate">
                      {selectedImageFile?.name || 'Imagen seleccionada'}
                    </p>
                    <p className="text-xs text-gray-700">
                      {selectedImageFile
                        ? `${(selectedImageFile.size / 1024).toFixed(0)} KB · Lista para subir`
                        : 'Imagen lista'}
                    </p>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="mt-2 px-3 py-1 text-xs font-bold text-brand-err-ink border border-brand-err-line hover:bg-brand-err-tint rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-err-line"
                    >
                      Quitar imagen y elegir otra
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="pet_foto_file"
                  className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-brand-line hover:border-brand-accent bg-brand-surface cursor-pointer transition focus-within:ring-2 focus-within:ring-brand-accent text-center"
                >
                  <span className="w-10 h-10 rounded-full bg-brand-accent-tint text-brand-accent flex items-center justify-center">
                    <FiUploadCloud className="w-5 h-5" />
                  </span>

                  <div>
                    <span className="text-xs sm:text-sm font-bold text-brand-ink block">
                      Seleccionar o arrastrar fotografía
                    </span>
                    <span className="text-[11px] text-gray-700 block">
                      JPG, PNG o WebP (máximo 5MB)
                    </span>
                  </div>

                  <input
                    id="pet_foto_file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="sr-only"
                  />
                </label>
              )}
            </div>

            {/* Sección 3: Necesidades de espacio, tiempo y costo */}
            <div className="bg-brand-bg/30 border border-brand-line rounded-xl p-3.5 sm:p-4 flex flex-col gap-3.5">
              <h3 className="text-sm font-bold text-brand-ink border-b border-brand-line pb-1.5">
                3. Condiciones de vida y cuidados
              </h3>

              <div>
                <span className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">
                  ¿Se adapta a vivir en apartamento? *
                </span>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                  role="radiogroup"
                  aria-label="Apto para apartamento"
                >
                  {[
                    { label: 'Sí, es apto para apartamento', value: true },
                    { label: 'No, requiere casa con patio o jardín', value: false },
                  ].map((opt) => {
                    const selected = Boolean(watchedApto) === opt.value;
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPetValue('apto_apartamento', opt.value)}
                        className={`py-2.5 px-3 rounded-lg text-xs font-bold border text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                          selected
                            ? 'border-brand-accent bg-brand-accent-tint text-brand-ink'
                            : 'border-brand-line bg-brand-surface text-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pet_horas" className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">
                    Horas mínimas de atención al día *
                  </label>
                  <input
                    id="pet_horas"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    placeholder="Ej. 2"
                    {...registerPet('horas_minimas_atencion', {
                      required: 'Ingresá las horas.',
                      min: { value: 0.5, message: 'Mínimo 0.5 h' },
                      max: { value: 24, message: 'Máximo 24 h' },
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-brand-line text-xs sm:text-sm text-brand-ink bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  />
                  {petErrors.horas_minimas_atencion && (
                    <p className="text-xs font-semibold text-brand-err-ink mt-0.5">
                      {petErrors.horas_minimas_atencion.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="pet_costo" className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">
                    Costo mensual estimado (colones ₡) *
                  </label>
                  <input
                    id="pet_costo"
                    type="number"
                    step="1000"
                    min="1000"
                    placeholder="Ej. 45000"
                    {...registerPet('costo_mensual_estimado', {
                      required: 'Ingresá el costo.',
                      min: { value: 1000, message: 'Mayor a ₡1.000' },
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-brand-line text-xs sm:text-sm text-brand-ink bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  />
                  {petErrors.costo_mensual_estimado && (
                    <p className="text-xs font-semibold text-brand-err-ink mt-0.5">
                      {petErrors.costo_mensual_estimado.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingPet || isUploadingImage}
                className="py-3 px-8 rounded-xl bg-brand-accent hover:bg-brand-accent/95 text-white font-bold text-sm cursor-pointer disabled:opacity-50 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                {isUploadingImage || isSavingPet ? 'Publicando mascota…' : 'Nueva mascota'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* PESTAÑA 2: LISTADO DE MASCOTAS REGISTRADAS */}
      {activeTab === 'listado' && (
        <section className="bg-brand-surface border border-brand-line rounded-2xl p-4 sm:p-6 shadow-sm w-full">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-brand-line">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-brand-ink">
                Mis mascotas registradas ({mascotas.length})
              </h2>
              <p className="text-xs text-gray-700">
                Tus mascotas activas participan en el match con adoptantes; las inactivas se conservan como historial.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('nuevo')}
                className="py-2 px-3.5 rounded-lg bg-brand-accent text-white text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                Nueva mascota
              </button>
              <button
                type="button"
                onClick={fetchMascotas}
                className="py-1.5 px-2.5 rounded-lg border border-brand-line hover:border-brand-accent text-xs font-bold text-brand-accent cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                Actualizar
              </button>
            </div>
          </div>

          {loadingPets ? (
            <div className="py-12 text-center text-gray-700">
              <div className="w-7 h-7 rounded-full border-3 border-brand-line border-t-brand-accent animate-spin mx-auto mb-2" />
              <p className="text-xs font-semibold">Cargando mascotas…</p>
            </div>
          ) : mascotas.length === 0 ? (
            <div className="py-12 px-4 text-center border-2 border-dashed border-brand-line rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-brand-accent-tint text-brand-accent mx-auto flex items-center justify-center mb-3">
                <FaPaw className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-brand-ink mb-1">
                Aún no has registrado mascotas a tu nombre
              </h3>
              <p className="text-xs text-gray-700 max-w-md mx-auto mb-4">
                Utilizá la pestaña &ldquo;Nueva mascota&rdquo; para agregar los animales que tenés disponibles en adopción.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('nuevo')}
                className="py-2.5 px-5 rounded-xl bg-brand-accent text-white font-bold text-xs cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent flex items-center gap-1.5 mx-auto"
              >
                <FaPaw className="w-3.5 h-3.5" />
                <span>Nueva mascota</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {mascotas.map((m) => {
                const isActiva = m.estado !== 'inactiva';
                return (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-3 flex flex-col justify-between transition ${
                      isActiva
                        ? 'border-brand-line bg-brand-surface'
                        : 'border-gray-300 bg-gray-50 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Foto o marcador visual */}
                      <div className="w-full h-32 rounded-lg overflow-hidden mb-2.5 border border-brand-line bg-white flex items-center justify-center">
                        {m.imagen_url ? (
                          <div
                            className="w-full h-full cursor-zoom-in"
                            onClick={() => setExpandedImage({ url: m.imagen_url, alt: `Foto de ${m.nombre}` })}
                            title="Haz clic para ampliar la foto"
                          >
                            <img
                              src={m.imagen_url}
                              alt={`Foto de ${m.nombre}`}
                              className="w-full h-full object-cover hover:scale-105 transition duration-300"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="text-center text-gray-400">
                            <span className="text-xs">Sin fotografía</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                        <div>
                          <h3 className="text-base font-bold text-brand-ink truncate">{m.nombre}</h3>
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                              isActiva
                                ? 'bg-brand-accent-tint text-brand-accent border border-brand-accent/30'
                                : 'bg-gray-200 text-gray-700 border border-gray-300'
                            }`}
                          >
                            {isActiva ? 'Activa (para match)' : 'Inactiva (adoptada)'}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-bg text-brand-ink whitespace-nowrap border border-brand-line">
                          {m.tipo} · {m.tamano}
                        </span>
                      </div>

                      <ul className="text-[11px] text-gray-700 space-y-1 mt-2 bg-brand-bg/40 p-2 rounded-lg">
                        <li>
                          <strong>Costo:</strong> {formatColones(m.costo_mensual_estimado)}/mes
                        </li>
                        <li>
                          <strong>Atención:</strong> {m.horas_minimas_atencion} h/día
                        </li>
                        <li>
                          <strong>Vivienda:</strong>{' '}
                          {m.apto_apartamento ? 'Apto apartamento' : 'Requiere patio'}
                        </li>
                      </ul>
                    </div>

                    <div className="pt-2.5 mt-2.5 border-t border-brand-line flex flex-nowrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => promptTogglePetStatus(m)}
                        className={`shrink-0 flex-1 py-1 px-2 rounded-md text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-1 ${
                          isActiva
                            ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white focus-visible:ring-red-400'
                            : 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white focus-visible:ring-emerald-400'
                        }`}
                      >
                        <FiPower className="w-3 h-3 shrink-0" />
                        <span>{isActiva ? 'Desactivar' : 'Activar'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => promptDeletePet(m.id, m.nombre)}
                        className="shrink-0 py-1 px-2.5 rounded-md border border-brand-err-line text-xs font-bold text-brand-err-ink hover:bg-brand-err-tint cursor-pointer transition flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-err-line"
                      >
                        <FiTrash2 className="w-3 h-3 shrink-0" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* PESTAÑA 3: INFORMACIÓN DE CONTACTO PARA ADOPCIONES */}
      {activeTab === 'contacto' && (
        <section className="bg-brand-surface border border-brand-line rounded-2xl p-4 sm:p-6 shadow-sm w-full animate-fade-in">
          <div className="flex items-start gap-3 mb-5 pb-4 border-b border-brand-line">
            <div className="w-10 h-10 rounded-xl bg-brand-accent-tint flex items-center justify-center text-brand-accent shrink-0">
              <FiPhone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-brand-ink">
                Información de Contacto para Adopciones
              </h2>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mt-0.5">
                Esta información se mostrará a los adoptantes que hagan match con las mascotas que vos registres para que puedan comunicarse directamente con vos o tu refugio.
              </p>
            </div>
          </div>

          {renderContactForm()}
        </section>
      )}
        </>
      )}

      {/* MODAL PERSONALIZADO DE CONFIRMACIÓN DE MASCOTA */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="relative bg-white border border-brand-line rounded-2xl max-w-md w-full p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-3">
              {confirmModal.action === 'activar' ? (
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border-2 border-emerald-200 shadow-xs">
                  <FiCheckCircle className="w-8 h-8" />
                </div>
              ) : confirmModal.action === 'desactivar' ? (
                <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center border-2 border-amber-200 shadow-xs">
                  <FiPower className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center border-2 border-red-200 shadow-xs">
                  <FiTrash2 className="w-8 h-8" />
                </div>
              )}
            </div>

            <h3 className="text-lg font-bold text-brand-ink mb-2">
              {confirmModal.action === 'activar' && '¿Activar mascota?'}
              {confirmModal.action === 'desactivar' && '¿Desactivar mascota?'}
              {confirmModal.action === 'eliminar' && '¿Eliminar mascota?'}
            </h3>

            <p className="text-sm text-gray-700 mb-3 leading-relaxed">
              ¿Estás seguro de que deseas{' '}
              <strong className="text-brand-ink">{confirmModal.action}</strong> a{' '}
              <strong className="text-brand-ink">"{confirmModal.name}"</strong>?
            </p>

            {confirmModal.action === 'desactivar' && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-4 text-left">
                ℹ Al desactivarla, se marcará como adoptada o no disponible y no se mostrará en los matches de los adoptantes.
              </p>
            )}

            {confirmModal.action === 'activar' && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 mb-4 text-left">
                ✓ Al activarla, volverá a estar disponible para que los adoptantes hagan match con ella.
              </p>
            )}

            {confirmModal.action === 'eliminar' && (
              <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-2.5 mb-4 text-left">
                ⚠ Esta acción es definitiva y no se puede deshacer. Se eliminará la ficha de la mascota permanentemente.
              </p>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm font-semibold text-gray-700 cursor-pointer transition shadow-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executePetConfirmAction}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white shadow-sm cursor-pointer transition ${
                  confirmModal.action === 'activar'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmModal.action === 'activar' && 'Sí, activar'}
                {confirmModal.action === 'desactivar' && 'Sí, desactivar'}
                {confirmModal.action === 'eliminar' && 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX / VISOR DE IMAGEN AMPLIADA */}
      {expandedImage && (
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
      )}
    </div>
  );
}
