import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import {
  FiEye,
  FiEdit2,
  FiTrash2,
  FiPower,
  FiMapPin,
  FiPhone,
  FiMail,
  FiExternalLink,
  FiClock,
  FiFileText,
  FiDownload,
  FiX,
  FiCheckCircle,
  FiFilter,
  FiChevronDown,
  FiCheck,
} from 'react-icons/fi';
import {
  FaHouse,
  FaStethoscope,
  FaBookOpen,
} from 'react-icons/fa6';

function StatusFilterSelector({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    { value: 'todos', label: 'Todos los estados' },
    { value: 'activo', label: 'Activos', dotColor: 'bg-emerald-500' },
    { value: 'inactivo', label: 'Inactivos', dotColor: 'bg-gray-400' },
  ];

  const currentOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-brand-line bg-brand-surface hover:border-brand-accent/50 text-brand-ink text-xs sm:text-sm font-semibold shadow-2xs transition cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <FiFilter className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <span className="text-gray-600 hidden xs:inline">Estado:</span>
        <span className="font-bold text-brand-ink flex items-center gap-1.5">
          {currentOption.dotColor && <span className={`w-2 h-2 rounded-full ${currentOption.dotColor}`} />}
          {currentOption.label}
        </span>
        <FiChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-white border border-brand-line shadow-lg z-30 py-1 animate-fade-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 text-xs sm:text-sm font-medium transition cursor-pointer text-left ${
                value === opt.value
                  ? 'bg-brand-accent-tint text-brand-accent font-bold'
                  : 'text-gray-700 hover:bg-brand-bg/60'
              }`}
            >
              <span className="flex items-center gap-2">
                {opt.dotColor && <span className={`w-2 h-2 rounded-full ${opt.dotColor}`} />}
                <span>{opt.label}</span>
              </span>
              {value === opt.value && <FiCheck className="w-3.5 h-3.5 text-brand-accent shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminResourcesManager({ currentTab = 'refugios' }) {
  const [refugios, setRefugios] = useState([]);
  const [veterinarios, setVeterinarios] = useState([]);
  const [guias, setGuias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  const [statusFilterRefugios, setStatusFilterRefugios] = useState('todos');
  const [statusFilterVeterinarios, setStatusFilterVeterinarios] = useState('todos');
  const [statusFilterGuias, setStatusFilterGuias] = useState('todos');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [viewingDetailsItem, setViewingDetailsItem] = useState(null);

  const [confirmModal, setConfirmModal] = useState(null);

  const [expandedImage, setExpandedImage] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');

  const {
    register: regRefugio,
    handleSubmit: handleSubRefugio,
    reset: resetRefugio,
    setValue: setValRefugio,
    formState: { errors: errRefugio },
  } = useForm({
    defaultValues: {
      nombre: '',
      descripcion: '',
      direccion: '',
      telefono: '',
      correo: '',
      enlace_web: '',
      estado: 'activo',
    },
  });

  const {
    register: regVet,
    handleSubmit: handleSubVet,
    reset: resetVet,
    setValue: setValVet,
    formState: { errors: errVet },
  } = useForm({
    defaultValues: {
      nombre: '',
      especialidad: '',
      direccion: '',
      horario: '',
      telefono: '',
      estado: 'activo',
    },
  });

  const {
    register: regGuia,
    handleSubmit: handleSubGuia,
    reset: resetGuia,
    setValue: setValGuia,
    formState: { errors: errGuia },
  } = useForm({
    defaultValues: {
      titulo: '',
      descripcion: '',
      estado: 'activo',
    },
  });

  function showFeedback(text, type = 'ok') {
    setActionMsg({ type, text });
    setTimeout(() => {
      setActionMsg({ type: '', text: '' });
    }, 3200);
  }

  useEffect(() => {
    fetchData();
  }, [currentTab]);

  async function fetchData() {
    setLoading(true);
    try {
      if (currentTab === 'refugios') {
        const { data, error } = await supabase
          .from('refugios')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRefugios(data || []);
      } else if (currentTab === 'veterinarios') {
        const { data, error } = await supabase
          .from('veterinarios')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setVeterinarios(data || []);
      } else if (currentTab === 'guias') {
        const { data, error } = await supabase
          .from('guias')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setGuias(data || []);
      }
    } catch (err) {
      showFeedback(`Error al cargar datos: ${err.message}`, 'warn');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingItem(null);
    setSelectedFile(null);
    setFilePreview('');
    if (currentTab === 'refugios') {
      resetRefugio({
        nombre: '',
        descripcion: '',
        direccion: '',
        telefono: '',
        correo: '',
        enlace_web: '',
        estado: 'activo',
      });
    } else if (currentTab === 'veterinarios') {
      resetVet({
        nombre: '',
        especialidad: '',
        direccion: '',
        horario: '',
        telefono: '',
        estado: 'activo',
      });
    } else if (currentTab === 'guias') {
      resetGuia({
        titulo: '',
        descripcion: '',
        estado: 'activo',
      });
    }
    setIsModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setSelectedFile(null);
    if (currentTab === 'refugios') {
      setValRefugio('nombre', item.nombre);
      setValRefugio('descripcion', item.descripcion || '');
      setValRefugio('direccion', item.direccion || '');
      setValRefugio('telefono', item.telefono || '');
      setValRefugio('correo', item.correo || item.email || '');
      setValRefugio('enlace_web', item.enlace_web || item.enlaces || '');
      setValRefugio('estado', item.estado || 'activo');
      setFilePreview(item.imagen_url || '');
    } else if (currentTab === 'veterinarios') {
      setValVet('nombre', item.nombre);
      setValVet('especialidad', item.especialidad || '');
      setValVet('direccion', item.direccion || '');
      setValVet('horario', item.horario || '');
      setValVet('telefono', item.telefono || '');
      setValVet('estado', item.estado || 'activo');
      setFilePreview(item.imagen_url || '');
    } else if (currentTab === 'guias') {
      setValGuia('titulo', item.titulo);
      setValGuia('descripcion', item.descripcion || '');
      setValGuia('estado', item.estado || 'activo');
      setFilePreview(item.documento_nombre || item.documento_url || '');
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingItem(null);
    setSelectedFile(null);
    setFilePreview('');
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showFeedback('El archivo supera los 10MB. Elegí uno más liviano.', 'warn');
      return;
    }

    if (currentTab === 'guias') {
      const fileNameLower = file.name.toLowerCase();
      const isDoc =
        file.type === 'application/pdf' ||
        file.type.includes('word') ||
        file.type.includes('officedocument') ||
        fileNameLower.endsWith('.pdf') ||
        fileNameLower.endsWith('.doc') ||
        fileNameLower.endsWith('.docx');
      if (!isDoc) {
        showFeedback(
          'En las guías solo se permiten documentos en formato PDF o Word (.pdf, .doc, .docx). No se permiten imágenes.',
          'warn'
        );
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
      setFilePreview(file.name);
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(file.name);
    }
  }

  function handleClearFile() {
    setSelectedFile(null);
    setFilePreview('');
  }

  async function uploadFileToBucket(bucketName) {
    if (!selectedFile) return null;
    const fileExt = selectedFile.name.split('.').pop() || 'bin';
    const safeBase = selectedFile.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15);
    const fileName = `${Date.now()}_${safeBase}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, selectedFile, {
        contentType: selectedFile.type,
        upsert: false,
      });

    if (uploadError) throw new Error(`Error en subida: ${uploadError.message}`);

    const { data: pubData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return {
      url: pubData?.publicUrl || '',
      name: selectedFile.name,
    };
  }

  async function onSaveRefugio(values) {
    setIsSubmitting(true);
    try {
      let finalImageUrl = editingItem?.imagen_url || null;
      if (selectedFile) {
        const uploadResult = await uploadFileToBucket('refugios');
        if (uploadResult?.url) finalImageUrl = uploadResult.url;
      }

      const cleanEmail = values.correo?.trim() || values.email?.trim() || '';
      const cleanWeb = values.enlace_web?.trim() || values.enlaces?.trim() || '';

      const payload = {
        nombre: values.nombre.trim(),
        descripcion: values.descripcion?.trim() || '',
        direccion: values.direccion?.trim() || '',
        telefono: values.telefono?.trim() || '',
        correo: cleanEmail,
        email: cleanEmail,
        enlace_web: cleanWeb,
        enlaces: cleanWeb,
        imagen_url: finalImageUrl,
        estado: values.estado || 'activo',
      };

      if (editingItem) {
        const { error } = await supabase
          .from('refugios')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        showFeedback(`¡Refugio "${payload.nombre}" actualizado correctamente!`);
      } else {
        const { error } = await supabase.from('refugios').insert([payload]);
        if (error) throw error;
        showFeedback(`¡Refugio "${payload.nombre}" registrado correctamente!`);
      }

      closeModal();
      fetchData();
    } catch (err) {
      showFeedback(`Error al guardar refugio: ${err.message}`, 'warn');
    } finally {
      setIsSubmitting(false);
    }
  }

  function requestToggleEstado(entity, item) {
    const nextEstado = item.estado === 'activo' ? 'inactivo' : 'activo';
    const accion = item.estado === 'activo' ? 'desactivar' : 'activar';
    const name = item.nombre || item.titulo || 'este registro';
    setConfirmModal({
      type: 'toggle',
      entity,
      item,
      action: accion,
      name,
      nextEstado,
    });
  }

  function requestDelete(entity, item) {
    const name = item.nombre || item.titulo || 'este registro';
    setConfirmModal({
      type: 'delete',
      entity,
      item,
      action: 'eliminar',
      name,
    });
  }

  async function executeConfirmAction() {
    if (!confirmModal) return;
    const { type, entity, item, nextEstado, name } = confirmModal;
    setConfirmModal(null);

    try {
      const table =
        entity === 'refugio'
          ? 'refugios'
          : entity === 'veterinario'
          ? 'veterinarios'
          : 'guias';

      if (type === 'toggle') {
        const { error } = await supabase
          .from(table)
          .update({ estado: nextEstado })
          .eq('id', item.id);
        if (error) throw error;

        if (entity === 'refugio') {
          setRefugios((prev) =>
            prev.map((r) => (r.id === item.id ? { ...r, estado: nextEstado } : r))
          );
          showFeedback(`Refugio "${name}" marcado como ${nextEstado}.`);
        } else if (entity === 'veterinario') {
          setVeterinarios((prev) =>
            prev.map((v) => (v.id === item.id ? { ...v, estado: nextEstado } : v))
          );
          showFeedback(`Veterinario "${name}" marcado como ${nextEstado}.`);
        } else if (entity === 'guia') {
          setGuias((prev) =>
            prev.map((g) => (g.id === item.id ? { ...g, estado: nextEstado } : g))
          );
          showFeedback(`Guía "${name}" marcada como ${nextEstado}.`);
        }
      } else if (type === 'delete') {
        const { error } = await supabase.from(table).delete().eq('id', item.id);
        if (error) throw error;

        if (entity === 'refugio') {
          setRefugios((prev) => prev.filter((r) => r.id !== item.id));
          showFeedback(`Refugio "${name}" eliminado.`);
        } else if (entity === 'veterinario') {
          setVeterinarios((prev) => prev.filter((v) => v.id !== item.id));
          showFeedback(`Veterinario "${name}" eliminado.`);
        } else if (entity === 'guia') {
          setGuias((prev) => prev.filter((g) => g.id !== item.id));
          showFeedback(`Guía "${name}" eliminada.`);
        }
      }
    } catch (err) {
      showFeedback(`Error: ${err.message}`, 'warn');
    }
  }

  async function onSaveVet(values) {
    setIsSubmitting(true);
    try {
      let finalImageUrl = editingItem?.imagen_url || null;
      if (selectedFile) {
        const uploadResult = await uploadFileToBucket('veterinarios');
        if (uploadResult?.url) finalImageUrl = uploadResult.url;
      }

      const payload = {
        nombre: values.nombre.trim(),
        especialidad: values.especialidad?.trim() || '',
        direccion: values.direccion?.trim() || '',
        horario: values.horario?.trim() || '',
        telefono: values.telefono?.trim() || '',
        imagen_url: finalImageUrl,
        estado: values.estado || 'activo',
      };

      if (editingItem) {
        const { error } = await supabase
          .from('veterinarios')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        showFeedback(`¡Veterinario "${payload.nombre}" actualizado!`);
      } else {
        const { error } = await supabase.from('veterinarios').insert([payload]);
        if (error) throw error;
        showFeedback(`¡Veterinario "${payload.nombre}" registrado!`);
      }

      closeModal();
      fetchData();
    } catch (err) {
      showFeedback(`Error al guardar veterinario: ${err.message}`, 'warn');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSaveGuia(values) {
    setIsSubmitting(true);
    try {
      let finalDocUrl = filePreview ? (editingItem?.documento_url || '') : '';
      let finalDocName = filePreview ? (editingItem?.documento_nombre || '') : '';

      if (selectedFile) {
        const uploadResult = await uploadFileToBucket('guias');
        if (uploadResult?.url) {
          finalDocUrl = uploadResult.url;
          finalDocName = uploadResult.name;
        }
      }

      const payload = {
        titulo: values.titulo.trim(),
        descripcion: values.descripcion?.trim() || '',
        documento_url: finalDocUrl,
        documento_nombre: finalDocName,
        estado: values.estado || 'activo',
      };

      if (editingItem) {
        const { error } = await supabase
          .from('guias')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        showFeedback(`¡Guía "${payload.titulo}" actualizada!`);
      } else {
        const { error } = await supabase.from('guias').insert([payload]);
        if (error) throw error;
        showFeedback(`¡Guía "${payload.titulo}" registrada!`);
      }

      closeModal();
      fetchData();
    } catch (err) {
      showFeedback(`Error al guardar guía: ${err.message}`, 'warn');
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredRefugios = refugios.filter((r) => {
    if (statusFilterRefugios === 'todos') return true;
    return r.estado === statusFilterRefugios;
  });

  const filteredVeterinarios = veterinarios.filter((v) => {
    if (statusFilterVeterinarios === 'todos') return true;
    return v.estado === statusFilterVeterinarios;
  });

  const filteredGuias = guias.filter((g) => {
    if (statusFilterGuias === 'todos') return true;
    return g.estado === statusFilterGuias;
  });

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Alerta de notificación temporal */}
      {actionMsg.text && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs animate-fade-in ${
            actionMsg.type === 'ok'
              ? 'border-brand-accent/50 bg-brand-accent-tint text-brand-ink'
              : 'border-brand-err-line bg-brand-err-tint text-brand-err-ink'
          }`}
        >
          <span>{actionMsg.type === 'ok' ? '✓' : 'ℹ'}</span>
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA: REFUGIOS VERIFICADOS                                         */}
      {/* ===================================================================== */}
      {currentTab === 'refugios' && (
        <section className="bg-brand-surface border border-brand-line rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-brand-line">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-brand-ink">
                Refugios Verificados ({filteredRefugios.length}{statusFilterRefugios !== 'todos' ? ` de ${refugios.length}` : ''})
              </h2>
              <p className="text-xs sm:text-sm text-gray-700">
                Organizaciones y personas registradas con procesos formales de adopción.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <StatusFilterSelector
                value={statusFilterRefugios}
                onChange={setStatusFilterRefugios}
              />
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer"
              >
                <FaHouse className="w-3.5 h-3.5" />
                <span>Nuevo Refugio</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-gray-500">Cargando refugios…</div>
          ) : refugios.length === 0 ? (
            <div className="py-12 px-4 border-2 border-dashed border-brand-line rounded-xl text-center text-xs text-gray-500">
              No hay refugios registrados en la plataforma.
            </div>
          ) : filteredRefugios.length === 0 ? (
            <div className="py-10 px-4 border-2 border-dashed border-brand-line rounded-xl text-center text-xs text-gray-500 flex flex-col items-center gap-2">
              <span>No hay refugios con estado "{statusFilterRefugios === 'activo' ? 'Activo' : 'Inactivo'}".</span>
              <button
                type="button"
                onClick={() => setStatusFilterRefugios('todos')}
                className="text-xs font-semibold text-brand-accent hover:underline cursor-pointer"
              >
                Mostrar todos los estados
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredRefugios.map((r) => (
                <div
                  key={r.id}
                  className="border-2 border-brand-line rounded-xl p-3.5 bg-white flex flex-col justify-between shadow-xs transition hover:border-brand-accent/60"
                >
                  <div className="flex items-start gap-3">
                    {r.imagen_url ? (
                      <img
                        src={r.imagen_url}
                        alt={r.nombre}
                        onClick={() => setExpandedImage({ url: r.imagen_url, alt: r.nombre })}
                        className="w-16 h-16 object-cover rounded-xl border border-brand-line flex-shrink-0 bg-gray-100 cursor-zoom-in hover:opacity-90 hover:ring-2 hover:ring-brand-accent transition"
                        title="Haz clic para ampliar la imagen"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
                        <FaHouse className="w-7 h-7" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-sm font-bold text-brand-ink truncate">{r.nombre}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            r.estado === 'activo'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-gray-100 text-gray-600 border border-gray-300'
                          }`}
                        >
                          {r.estado === 'activo' ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      {r.direccion && (
                        <p className="text-xs text-gray-500 truncate mb-1 flex items-center gap-1">
                          <FiMapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{r.direccion}</span>
                        </p>
                      )}
                      {r.descripcion && (
                        <p className="text-xs text-gray-700 line-clamp-2 leading-snug">
                          {r.descripcion}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Acciones CRUD con "Ver detalles" en una sola fila */}
                  <div className="flex flex-nowrap items-center justify-end gap-1 sm:gap-1.5 pt-3 mt-3 border-t border-brand-line w-full overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setViewingDetailsItem({ ...r, _type: 'refugio' })}
                      className="shrink-0 py-1 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Ver información"
                    >
                      <FiEye className="w-3.5 h-3.5 shrink-0" />
                      <span>Ver</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestToggleEstado('refugio', r)}
                      className={`shrink-0 py-1 px-2 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border transition cursor-pointer flex items-center gap-1 ${
                        r.estado === 'activo'
                          ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white'
                          : 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white'
                      }`}
                      title={r.estado === 'activo' ? 'Desactivar refugio' : 'Activar refugio'}
                    >
                      <FiPower className="w-3.5 h-3.5 shrink-0" />
                      <span>{r.estado === 'activo' ? 'Desactivar' : 'Activar'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(r)}
                      className="shrink-0 py-1 px-2 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition cursor-pointer flex items-center gap-1"
                      title="Editar refugio"
                    >
                      <FiEdit2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete('refugio', r)}
                      className="shrink-0 py-1 px-2 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border border-brand-err-line text-brand-err-ink hover:bg-brand-err-tint transition cursor-pointer flex items-center gap-1"
                      title="Eliminar refugio"
                    >
                      <FiTrash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA: VETERINARIOS RECOMENDADOS                                    */}
      {/* ===================================================================== */}
      {currentTab === 'veterinarios' && (
        <section className="bg-brand-surface border border-brand-line rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-brand-line">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-brand-ink">
                Veterinarios Recomendados ({filteredVeterinarios.length}{statusFilterVeterinarios !== 'todos' ? ` de ${veterinarios.length}` : ''})
              </h2>
              <p className="text-xs sm:text-sm text-gray-700">
                Clínicas veterinarias y especialistas de salud animal para adoptantes.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <StatusFilterSelector
                value={statusFilterVeterinarios}
                onChange={setStatusFilterVeterinarios}
              />
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer"
              >
                <FaStethoscope className="w-3.5 h-3.5" />
                <span>Nuevo Veterinario</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-gray-500">Cargando veterinarios…</div>
          ) : veterinarios.length === 0 ? (
            <div className="py-12 px-4 border-2 border-dashed border-brand-line rounded-xl text-center text-xs text-gray-500">
              No hay veterinarios registrados en la plataforma.
            </div>
          ) : filteredVeterinarios.length === 0 ? (
            <div className="py-10 px-4 border-2 border-dashed border-brand-line rounded-xl text-center text-xs text-gray-500 flex flex-col items-center gap-2">
              <span>No hay veterinarios con estado "{statusFilterVeterinarios === 'activo' ? 'Activo' : 'Inactivo'}".</span>
              <button
                type="button"
                onClick={() => setStatusFilterVeterinarios('todos')}
                className="text-xs font-semibold text-brand-accent hover:underline cursor-pointer"
              >
                Mostrar todos los estados
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredVeterinarios.map((v) => (
                <div
                  key={v.id}
                  className="border-2 border-brand-line rounded-xl p-3.5 bg-white flex flex-col justify-between shadow-xs transition hover:border-brand-accent/60"
                >
                  <div className="flex items-start gap-3">
                    {v.imagen_url ? (
                      <img
                        src={v.imagen_url}
                        alt={v.nombre}
                        onClick={() => setExpandedImage({ url: v.imagen_url, alt: v.nombre })}
                        className="w-16 h-16 object-cover rounded-xl border border-brand-line flex-shrink-0 bg-gray-100 cursor-zoom-in hover:opacity-90 hover:ring-2 hover:ring-brand-accent transition"
                        title="Haz clic para ampliar la imagen"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 flex-shrink-0">
                        <FaStethoscope className="w-7 h-7" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-sm font-bold text-brand-ink truncate">{v.nombre}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            v.estado === 'activo'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-gray-100 text-gray-600 border border-gray-300'
                          }`}
                        >
                          {v.estado === 'activo' ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      {v.direccion && (
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                          <FiMapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{v.direccion}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Acciones CRUD con "Ver detalles" en una sola fila */}
                  <div className="flex flex-nowrap items-center justify-end gap-1 sm:gap-1.5 pt-3 mt-3 border-t border-brand-line w-full overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setViewingDetailsItem({ ...v, _type: 'veterinario' })}
                      className="shrink-0 py-1 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Ver información"
                    >
                      <FiEye className="w-3.5 h-3.5 shrink-0" />
                      <span>Ver</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestToggleEstado('veterinario', v)}
                      className={`shrink-0 py-1 px-2 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border transition cursor-pointer flex items-center gap-1 ${
                        v.estado === 'activo'
                          ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white'
                          : 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white'
                      }`}
                      title={v.estado === 'activo' ? 'Desactivar veterinario' : 'Activar veterinario'}
                    >
                      <FiPower className="w-3.5 h-3.5 shrink-0" />
                      <span>{v.estado === 'activo' ? 'Desactivar' : 'Activar'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(v)}
                      className="shrink-0 py-1 px-2 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition cursor-pointer flex items-center gap-1"
                      title="Editar veterinario"
                    >
                      <FiEdit2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete('veterinario', v)}
                      className="shrink-0 py-1 px-2 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border border-brand-err-line text-brand-err-ink hover:bg-brand-err-tint transition cursor-pointer flex items-center gap-1"
                      title="Eliminar veterinario"
                    >
                      <FiTrash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA: GUÍAS DE CUIDADO                                             */}
      {/* ===================================================================== */}
      {currentTab === 'guias' && (
        <section className="bg-brand-surface border border-brand-line rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-brand-line">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-brand-ink">
                Guías de Cuidado ({filteredGuias.length}{statusFilterGuias !== 'todos' ? ` de ${guias.length}` : ''})
              </h2>
              <p className="text-xs sm:text-sm text-gray-700">
                Materiales, documentos y manuales descargables para familias adoptantes.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <StatusFilterSelector
                value={statusFilterGuias}
                onChange={setStatusFilterGuias}
              />
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer"
              >
                <FaBookOpen className="w-3.5 h-3.5" />
                <span>Nueva Guía</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-gray-500">Cargando guías…</div>
          ) : guias.length === 0 ? (
            <div className="py-12 px-4 border-2 border-dashed border-brand-line rounded-xl text-center text-xs text-gray-500">
              No hay guías registradas en la plataforma.
            </div>
          ) : filteredGuias.length === 0 ? (
            <div className="py-10 px-4 border-2 border-dashed border-brand-line rounded-xl text-center text-xs text-gray-500 flex flex-col items-center gap-2">
              <span>No hay guías con estado "{statusFilterGuias === 'activo' ? 'Activo' : 'Inactivo'}".</span>
              <button
                type="button"
                onClick={() => setStatusFilterGuias('todos')}
                className="text-xs font-semibold text-brand-accent hover:underline cursor-pointer"
              >
                Mostrar todos los estados
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredGuias.map((g) => (
                <div
                  key={g.id}
                  className="border-2 border-brand-line rounded-xl p-4 bg-white flex flex-col justify-between shadow-xs transition hover:border-brand-accent/60"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-sm sm:text-base font-bold text-brand-ink flex items-center gap-1.5">
                        <FaBookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{g.titulo}</span>
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          g.estado === 'activo'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300'
                        }`}
                      >
                        {g.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    {g.descripcion && (
                      <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed mb-3">
                        {g.descripcion}
                      </p>
                    )}
                  </div>

                  {/* Acciones CRUD con "Ver detalles" en una sola fila */}
                  <div className="flex flex-nowrap items-center justify-end gap-1 sm:gap-1.5 pt-3 mt-3 border-t border-brand-line w-full overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setViewingDetailsItem({ ...g, _type: 'guia' })}
                      className="shrink-0 py-1 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Ver información"
                    >
                      <FiEye className="w-3.5 h-3.5 shrink-0" />
                      <span>Ver</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestToggleEstado('guia', g)}
                      className={`shrink-0 py-1 px-2 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border transition cursor-pointer flex items-center gap-1 ${
                        g.estado === 'activo'
                          ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white'
                          : 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white'
                      }`}
                      title={g.estado === 'activo' ? 'Desactivar guía' : 'Activar guía'}
                    >
                      <FiPower className="w-3.5 h-3.5 shrink-0" />
                      <span>{g.estado === 'activo' ? 'Desactivar' : 'Activar'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(g)}
                      className="shrink-0 py-1 px-2 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition cursor-pointer flex items-center gap-1"
                      title="Editar guía"
                    >
                      <FiEdit2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete('guia', g)}
                      className="shrink-0 py-1 px-2 sm:px-2.5 rounded-lg text-[11px] sm:text-xs font-bold border border-brand-err-line text-brand-err-ink hover:bg-brand-err-tint transition cursor-pointer flex items-center gap-1"
                      title="Eliminar guía"
                    >
                      <FiTrash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* MODAL PARA VER DETALLES (ADMINISTRATIVO)                              */}
      {/* ===================================================================== */}
      {viewingDetailsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="relative bg-brand-surface border border-brand-line rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-brand-line mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-brand-accent-tint text-brand-accent">
                  Detalles Completos
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    viewingDetailsItem.estado === 'activo'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {viewingDetailsItem.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingDetailsItem(null)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                aria-label="Cerrar detalles"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* DETALLES DE REFUGIO */}
            {viewingDetailsItem._type === 'refugio' && (
              <div className="space-y-4">
                {viewingDetailsItem.imagen_url && (
                  <div className="flex flex-col items-center mb-3">
                    <img
                      src={viewingDetailsItem.imagen_url}
                      alt={viewingDetailsItem.nombre}
                      onClick={() => setExpandedImage({ url: viewingDetailsItem.imagen_url, alt: viewingDetailsItem.nombre })}
                      className="max-w-full max-h-[70vh] w-auto h-auto rounded-xl border border-brand-line shadow-xs object-contain cursor-zoom-in hover:opacity-90 transition"
                      title="Haz clic para ver la imagen ampliada"
                    />
                  </div>
                )}
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-2">
                    <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Refugio Verificado</span>
                  </div>
                  <h3 className="text-xl font-bold text-brand-ink">{viewingDetailsItem.nombre}</h3>
                  {viewingDetailsItem.descripcion && (
                    <p className="text-xs sm:text-sm text-gray-700 mt-2 leading-relaxed">
                      {viewingDetailsItem.descripcion}
                    </p>
                  )}
                </div>

                <div className="bg-brand-bg/40 border border-brand-line rounded-xl p-3.5 space-y-2 text-xs">
                  {viewingDetailsItem.direccion && (
                    <div>
                      <span className="font-bold text-gray-700 flex items-center gap-1 mb-0.5">
                        <FiMapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span>Dirección:</span>
                      </span>
                      <span className="text-gray-800 pl-4 block">{viewingDetailsItem.direccion}</span>
                    </div>
                  )}
                  {viewingDetailsItem.telefono && (
                    <div>
                      <span className="font-bold text-gray-700 flex items-center gap-1 mb-0.5">
                        <FiPhone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span>Teléfono:</span>
                      </span>
                      <span className="text-gray-800 pl-4 block">{viewingDetailsItem.telefono}</span>
                    </div>
                  )}
                  {(viewingDetailsItem.correo || viewingDetailsItem.email) && (
                    <div>
                      <span className="font-bold text-gray-700 flex items-center gap-1 mb-0.5">
                        <FiMail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span>Correo electrónico:</span>
                      </span>
                      <span className="text-gray-800 pl-4 block">{viewingDetailsItem.correo || viewingDetailsItem.email}</span>
                    </div>
                  )}
                  {(viewingDetailsItem.enlace_web || viewingDetailsItem.enlaces) && (
                    <div>
                      <span className="font-bold text-gray-700 flex items-center gap-1 mb-0.5">
                        <FiExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Enlace directo:</span>
                      </span>
                      <div className="pl-4">
                        <a
                          href={(viewingDetailsItem.enlace_web || viewingDetailsItem.enlaces).startsWith('http')
                            ? (viewingDetailsItem.enlace_web || viewingDetailsItem.enlaces)
                            : `https://${viewingDetailsItem.enlace_web || viewingDetailsItem.enlaces}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline break-all font-semibold"
                        >
                          {viewingDetailsItem.enlace_web || viewingDetailsItem.enlaces}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DETALLES DE VETERINARIO */}
            {viewingDetailsItem._type === 'veterinario' && (
              <div className="space-y-4">
                {viewingDetailsItem.imagen_url && (
                  <div className="flex flex-col items-center mb-3">
                    <img
                      src={viewingDetailsItem.imagen_url}
                      alt={viewingDetailsItem.nombre}
                      onClick={() => setExpandedImage({ url: viewingDetailsItem.imagen_url, alt: viewingDetailsItem.nombre })}
                      className="max-w-full max-h-[70vh] w-auto h-auto rounded-xl border border-brand-line shadow-xs object-contain cursor-zoom-in hover:opacity-90 transition"
                      title="Haz clic para ver la imagen ampliada"
                    />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-brand-ink">{viewingDetailsItem.nombre}</h3>
                  {viewingDetailsItem.especialidad && (
                    <span className="inline-block text-xs font-semibold text-brand-accent bg-brand-accent-tint rounded-full px-2.5 py-0.5 mt-1.5">
                      {viewingDetailsItem.especialidad}
                    </span>
                  )}
                </div>

                <div className="bg-brand-bg/40 border border-brand-line rounded-xl p-3.5 space-y-2 text-xs">
                  {viewingDetailsItem.horario && (
                    <div>
                      <span className="font-bold text-gray-700 flex items-center gap-1 mb-0.5">
                        <FiClock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span>Horario de atención:</span>
                      </span>
                      <span className="text-gray-800 pl-4 block">{viewingDetailsItem.horario}</span>
                    </div>
                  )}
                  {viewingDetailsItem.direccion && (
                    <div>
                      <span className="font-bold text-gray-700 flex items-center gap-1 mb-0.5">
                        <FiMapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span>Dirección:</span>
                      </span>
                      <span className="text-gray-800 pl-4 block">{viewingDetailsItem.direccion}</span>
                    </div>
                  )}
                  {viewingDetailsItem.telefono && (
                    <div>
                      <span className="font-bold text-gray-700 flex items-center gap-1 mb-0.5">
                        <FiPhone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span>Teléfono:</span>
                      </span>
                      <span className="text-gray-800 pl-4 block">{viewingDetailsItem.telefono}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DETALLES DE GUÍA */}
            {viewingDetailsItem._type === 'guia' && (
              <div className="space-y-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 mb-2">
                    <FaBookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Guía de Cuidado</span>
                  </div>
                  <h3 className="text-xl font-bold text-brand-ink">{viewingDetailsItem.titulo}</h3>
                  {viewingDetailsItem.descripcion && (
                    <p className="text-xs sm:text-sm text-gray-700 mt-2 leading-relaxed">
                      {viewingDetailsItem.descripcion}
                    </p>
                  )}
                </div>

                <div className="bg-brand-bg/40 border border-brand-line rounded-xl p-4">
                  {viewingDetailsItem.documento_url ? (
                    <a
                      href={viewingDetailsItem.documento_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs sm:text-sm shadow-sm transition"
                    >
                      <FiExternalLink className="w-4 h-4 shrink-0" />
                      <span>Abrir</span>
                    </a>
                  ) : (
                    <p className="text-xs text-gray-500 italic text-center">Esta guía no tiene documento adjunto.</p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-brand-line flex justify-end">
              <button
                type="button"
                onClick={() => setViewingDetailsItem(null)}
                className="py-2 px-5 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm transition cursor-pointer shadow-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL GLOBAL PARA FORMULARIO (CREAR O EDITAR)                         */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="relative bg-brand-surface border border-brand-line rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Cabecera del modal */}
            <div className="flex items-center justify-between pb-3 border-b border-brand-line mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-brand-ink">
                  {currentTab === 'refugios' && (editingItem ? `Editar Refugio: ${editingItem.nombre}` : 'Registrar Nuevo Refugio')}
                  {currentTab === 'veterinarios' && (editingItem ? `Editar Veterinario: ${editingItem.nombre}` : 'Registrar Nuevo Veterinario')}
                  {currentTab === 'guias' && (editingItem ? `Editar Guía: ${editingItem.titulo}` : 'Registrar Nueva Guía')}
                </h3>
                <p className="text-xs text-gray-700">
                  {editingItem ? 'Modificá los campos necesarios.' : 'Completá los datos para agregarlo a la plataforma.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                aria-label="Cerrar modal"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* FORMULARIO REFUGIOS */}
            {currentTab === 'refugios' && (
              <form onSubmit={handleSubRefugio(onSaveRefugio)} className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Refugio *</label>
                  <input
                    type="text"
                    placeholder="Ej. Albergue Patitas de Guanacaste"
                    {...regRefugio('nombre', { required: 'Ingresá el nombre.' })}
                    className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  />
                  {errRefugio.nombre && (
                    <span className="text-xs text-brand-err-ink font-semibold mt-1 block">
                      {errRefugio.nombre.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Descripción</label>
                  <textarea
                    placeholder="Breve reseña sobre su labor o requisitos de adopción"
                    rows={2}
                    {...regRefugio('descripcion')}
                    className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Dirección</label>
                    <input
                      type="text"
                      placeholder="Ej. Nicoya centro"
                      {...regRefugio('direccion')}
                      className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
                    <input
                      type="text"
                      placeholder="Ej. 2685-4433"
                      {...regRefugio('telefono')}
                      className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Correo electrónico</label>
                    <input
                      type="email"
                      placeholder="contacto@refugio.org"
                      {...regRefugio('correo')}
                      className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Web / Redes sociales</label>
                    <input
                      type="text"
                      placeholder="https://facebook.com/..."
                      {...regRefugio('enlace_web')}
                      className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Fotografía o Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-accent-tint file:text-brand-accent cursor-pointer"
                  />
                  {filePreview && (
                    <div className="mt-2.5 flex items-center gap-2.5 p-2 bg-brand-bg/50 rounded-xl border border-brand-line">
                      <img src={filePreview} alt="Previa" className="w-14 h-14 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="text-xs text-brand-err-ink font-semibold hover:underline"
                      >
                        Quitar foto
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Estado</label>
                  <select
                    {...regRefugio('estado')}
                    className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  >
                    <option value="activo">Activo (visible al público)</option>
                    <option value="inactivo">Inactivo (oculto temporalmente)</option>
                  </select>
                </div>

                {/* Botones del modal */}
                <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-brand-line">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="py-2 px-4 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm font-semibold text-gray-700 cursor-pointer transition shadow-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2 px-5 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs sm:text-sm shadow-sm cursor-pointer disabled:opacity-50 transition"
                  >
                    {isSubmitting ? 'Guardando…' : editingItem ? 'Actualizar refugio' : 'Guardar refugio'}
                  </button>
                </div>
              </form>
            )}

            {/* FORMULARIO VETERINARIOS */}
            {currentTab === 'veterinarios' && (
              <form onSubmit={handleSubVet(onSaveVet)} className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nombre de la Clínica o Especialista *</label>
                  <input
                    type="text"
                    placeholder="Ej. Clínica Veterinaria San Francisco"
                    {...regVet('nombre', { required: 'Ingresá el nombre.' })}
                    className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  />
                  {errVet.nombre && (
                    <span className="text-xs text-brand-err-ink font-semibold mt-1 block">
                      {errVet.nombre.message}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Especialidad / Servicios</label>
                    <input
                      type="text"
                      placeholder="Ej. Urgencias 24/7 y Cirugía"
                      {...regVet('especialidad')}
                      className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Horario</label>
                    <input
                      type="text"
                      placeholder="Ej. Lunes a Sábado 8:00 - 18:00"
                      {...regVet('horario')}
                      className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Dirección</label>
                    <input
                      type="text"
                      placeholder="Ej. Santa Cruz centro"
                      {...regVet('direccion')}
                      className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
                    <input
                      type="text"
                      placeholder="Ej. 2680-1234"
                      {...regVet('telefono')}
                      className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Fotografía o Imagen</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-accent-tint file:text-brand-accent cursor-pointer"
                  />
                  {filePreview && (
                    <div className="mt-2.5 flex items-center gap-2.5 p-2 bg-brand-bg/50 rounded-xl border border-brand-line">
                      <img src={filePreview} alt="Previa" className="w-14 h-14 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="text-xs text-brand-err-ink font-semibold hover:underline"
                      >
                        Quitar foto
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Estado</label>
                  <select
                    {...regVet('estado')}
                    className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  >
                    <option value="activo">Activo (visible al público)</option>
                    <option value="inactivo">Inactivo (oculto temporalmente)</option>
                  </select>
                </div>

                {/* Botones del modal */}
                <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-brand-line">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="py-2 px-4 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm font-semibold text-gray-700 cursor-pointer transition shadow-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2 px-5 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs sm:text-sm shadow-sm cursor-pointer disabled:opacity-50 transition"
                  >
                    {isSubmitting ? 'Guardando…' : editingItem ? 'Actualizar veterinario' : 'Guardar veterinario'}
                  </button>
                </div>
              </form>
            )}

            {/* FORMULARIO GUÍAS DE CUIDADO */}
            {currentTab === 'guias' && (
              <form onSubmit={handleSubGuia(onSaveGuia)} className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Título de la Guía *</label>
                  <input
                    type="text"
                    placeholder="Ej. Manual de Primeros Días en Casa"
                    {...regGuia('titulo', { required: 'Ingresá el título.' })}
                    className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  />
                  {errGuia.titulo && (
                    <span className="text-xs text-brand-err-ink font-semibold mt-1 block">
                      {errGuia.titulo.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Descripción / Resumen</label>
                  <textarea
                    placeholder="Detalles sobre lo que aprenderá el adoptante con esta guía"
                    rows={3}
                    {...regGuia('descripcion')}
                    className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent resize-y"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Documento Adjunto (PDF o Word)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-accent-tint file:text-brand-accent cursor-pointer"
                  />
                  {filePreview && (
                    <div className="mt-2.5 flex items-center justify-between p-2.5 bg-brand-bg/50 rounded-xl border border-brand-line text-xs text-brand-ink">
                      <span className="font-medium truncate flex items-center gap-1.5">
                        <FiFileText className="w-4 h-4 text-brand-accent shrink-0" />
                        <span className="truncate">{filePreview}</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="text-xs text-brand-err-ink font-semibold hover:underline ml-2 shrink-0"
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Estado</label>
                  <select
                    {...regGuia('estado')}
                    className="w-full px-3 py-2 rounded-xl border-2 border-brand-line text-sm text-brand-ink bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  >
                    <option value="activo">Activo (visible al público)</option>
                    <option value="inactivo">Inactivo (oculto temporalmente)</option>
                  </select>
                </div>

                {/* Botones del modal */}
                <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-brand-line">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="py-2 px-4 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm font-semibold text-gray-700 cursor-pointer transition shadow-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2 px-5 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs sm:text-sm shadow-sm cursor-pointer disabled:opacity-50 transition"
                  >
                    {isSubmitting ? 'Guardando…' : editingItem ? 'Actualizar guía' : 'Guardar guía'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL PERSONALIZADO DE CONFIRMACIÓN (ACTIVAR / DESACTIVAR / ELIMINAR) */}
      {/* ===================================================================== */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="relative bg-white border border-brand-line rounded-2xl max-w-md w-full p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ícono de estado */}
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

            {/* Título */}
            <h3 className="text-lg font-bold text-brand-ink mb-2">
              {confirmModal.action === 'activar' && '¿Confirmar activación?'}
              {confirmModal.action === 'desactivar' && '¿Confirmar desactivación?'}
              {confirmModal.action === 'eliminar' && '¿Eliminar registro permanentemente?'}
            </h3>

            {/* Mensaje descriptivo */}
            <p className="text-sm text-gray-700 mb-3 leading-relaxed">
              ¿Estás seguro de que deseas{' '}
              <strong className="text-brand-ink">{confirmModal.action}</strong>{' '}
              {confirmModal.entity === 'refugio'
                ? 'el refugio'
                : confirmModal.entity === 'veterinario'
                ? 'el veterinario'
                : 'la guía'}{' '}
              <strong className="text-brand-ink">"{confirmModal.name}"</strong>?
            </p>

            {confirmModal.action === 'desactivar' && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-4 text-left">
                ℹ El registro no se borrará, pero dejará de estar visible temporalmente en la sección pública para los adoptantes.
              </p>
            )}

            {confirmModal.action === 'activar' && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 mb-4 text-left">
                ✓ El registro volverá a estar disponible e inmediatamente visible para todos los adoptantes en la plataforma.
              </p>
            )}

            {confirmModal.action === 'eliminar' && (
              <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-2.5 mb-4 text-left">
                ⚠ Esta acción es definitiva y no se puede deshacer. Se eliminará permanentemente de la base de datos.
              </p>
            )}

            {/* Botones de acción */}
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
                onClick={executeConfirmAction}
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

      {/* ===================================================================== */}
      {/* MODAL LIGHTBOX / VISOR DE IMAGEN AMPLIADA                             */}
      {/* ===================================================================== */}
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
