// Datos de sesiones de estudio (simulando almacenamiento)
let sesiones = [];

// Elementos DOM
const pages = document.querySelectorAll(".page");
const navButtons = document.querySelectorAll(".nav-btn");
const startStudyBtn = document.getElementById("start-study-btn");
const viewStatsBtn = document.getElementById("view-stats-btn");
const estudioForm = document.getElementById("estudio-form");
const historialBody = document.getElementById("historial-body");
const filtroFecha = document.getElementById("filtroFecha");
const filtroMateria = document.getElementById("filtroMateria");
const selectAllCheckbox = document.getElementById("selectAll");
const deleteSelectedBtn = document.getElementById("deleteSelected");
const materiaSelect = document.getElementById("materia");
const otraMateriaGroup = document.getElementById("otra-materia-group");
const otraMateriaInput = document.getElementById("otra-materia");

// Variables para los pickers de Tempus Dominus (declaradas en un ámbito accesible)
let fechaPicker;
let horaInicioPicker;
let horaFinPicker;

// Verificar autenticación
async function verificarAutenticacion() {
    const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
    
    if (!usuarioActual) {
        window.location.href = 'login.html';
        return false;
    }
    
    // Cargar sesiones del usuario actual
    sesiones = await obtenerSesionesUsuario(usuarioActual.id);
    // Actualizar interfaz inmediatamente después de cargar sesiones
    await actualizarHistorial();
    await actualizarEstadisticas();
    
    return true;
}

// Obtener sesiones de usuario desde Firebase
async function obtenerSesionesUsuario(usuarioId) {
    const snapshot = await db.ref('sesiones/' + usuarioId).once('value');
    const data = snapshot.val();
    console.log('Sesiones obtenidas para usuario', usuarioId, data);
    if (!data) return [];
    // Convierte el objeto en array, agrega el id y normaliza la fecha
    return Object.entries(data).map(([id, sesion]) => {
        // Normalizar fecha a formato ISO si es posible
        let fechaISO = sesion.fecha;
        if (fechaISO && !fechaISO.includes('T')) {
            // Si la fecha es solo YYYY-MM-DD, conviértela a ISO
            fechaISO = new Date(fechaISO).toISOString();
        }
        return { ...sesion, id, fecha: fechaISO };
    });
}

// Guardar sesión en Firebase
async function guardarSesion(usuarioId, sesion) {
    const nuevaSesionRef = db.ref('sesiones/' + usuarioId).push();
    await nuevaSesionRef.set(sesion);
}

// Configuración de Tempus Dominus
window.addEventListener("DOMContentLoaded", async function() {
    // Si existe la bandera de recarga, recargar la página y eliminar la bandera
    if (localStorage.getItem('recargar') === '1') {
        localStorage.removeItem('recargar');
        location.reload();
        return;
    }

    // Verificar autenticación. Si falla, redirigirá y el script se detendrá.
    if (await verificarAutenticacion()) {
        await actualizarHistorial();
        await actualizarEstadisticas();
        await actualizarPerfilUsuario();
    }

    // Configurar locale en español e inicializar selectores de fecha y hora
    const inputFecha = document.getElementById('fecha');
    const inputHoraInicio = document.getElementById('hora-inicio');
    const inputHoraFin = document.getElementById('hora-fin');

    // Establecer valores iniciales
    if (inputFecha) {
        inputFecha.value = new Date().toISOString().split('T')[0];
    }
    if (inputHoraInicio) {
        inputHoraInicio.value = "08:00";
    }
    if (inputHoraFin) {
        inputHoraFin.value = "09:00";
    }

    // Activar la navegación
    navButtons[0].classList.add("active");

    // Lógica para el formulario de meta de estudio
    const goalForm = document.getElementById('goal-form');
    if(goalForm){
        goalForm.addEventListener('submit', async function(e){
            e.preventDefault(); // Prevenir submit por defecto
            const horas = Number(document.getElementById('goal-hours').value);
            guardarMetaEstudio(horas);
            actualizarEstadisticas(); // Actualizar progreso inmediatamente
            // Mantener el valor en el input
            document.getElementById('goal-hours').value = horas;
            // Mensaje de éxito
            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    icon: 'success',
                    title: 'Meta guardada',
                    text: `Tu meta semanal es de ${horas} horas`,
                    confirmButtonColor: '#a67c52'
                });
            }
        });
        // Mostrar meta guardada al cargar
        document.getElementById('goal-hours').value = obtenerMetaEstudio() || '';
    }

    // Eliminar listeners de exportar historial y estadísticas
    // ...
    // Nuevo botón de exportar PDF en perfil
    const btnExportPDF = document.getElementById('btn-export-pdf');
    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', async function() {
            const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
            let sesionesFiltradas = [...sesiones]; // Usar todas las sesiones globales
            // Calcular estadísticas y meta
            const meta = await obtenerMetaEstudio();
            const hoy = new Date();
            // Puedes ajustar el rango si quieres solo el mes actual, pero aquí usamos todas
            const totalHoras = sesionesFiltradas.reduce((a,s)=>a+parseFloat(s.duracion),0);
            const {prom,med,mod} = calcularEstadisticasDuracion(sesionesFiltradas);
            // Resumen automático
            let diaMas = 'Ninguno', maxHoras = 0;
            const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
            const horasPorDia = {};
            diasSemana.forEach((dia) => { horasPorDia[dia] = 0; });
            sesionesFiltradas.forEach((sesion) => {
                const fecha = new Date(sesion.fecha);
                const diaSemana = diasSemana[fecha.getDay()];
                horasPorDia[diaSemana] += Number.parseFloat(sesion.duracion);
            });
            for (const dia of diasSemana) {
                if (horasPorDia[dia] > maxHoras) {
                    maxHoras = horasPorDia[dia];
                    diaMas = dia;
                }
            }
            let sesionLarga = 0;
            sesionesFiltradas.forEach(s => {
                if (parseFloat(s.duracion) > sesionLarga) sesionLarga = parseFloat(s.duracion);
            });
            const horasPorMateria = {};
            sesionesFiltradas.forEach(s => {
                if (!horasPorMateria[s.materia]) horasPorMateria[s.materia] = 0;
                horasPorMateria[s.materia] += parseFloat(s.duracion);
            });
            let materiaMas = 'Ninguna', maxMateria = 0;
            Object.entries(horasPorMateria).forEach(([mat, h]) => {
                if (h > maxMateria) { maxMateria = h; materiaMas = mat; }
            });
            let avance = meta > 0 ? (totalHoras / meta) * 100 : 0;
            avance = Math.round(avance);
            // PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text('EstudiApp - Historial y Estadísticas', 14, 15);
            doc.setFontSize(12);
            doc.text('Usuario: ' + (usuarioActual?.nombre || 'Desconocido'), 14, 25);
            doc.text('Fecha de exportación: ' + new Date().toLocaleDateString(), 14, 32);
            let y = 42;
            doc.setFontSize(14);
            doc.text('Meta de estudio mensual:', 14, y);
            doc.setFontSize(12);
            doc.text(meta > 0 ? `${meta} horas` : 'Sin meta', 80, y);
            y += 7;
            doc.text('Total de horas:', 14, y);
            doc.text(totalHoras.toFixed(1), 80, y);
            y += 7;
            doc.text('Duración promedio de sesión:', 14, y);
            doc.text(prom.toFixed(2), 80, y);
            y += 7;
            doc.text('Duración mediana de sesión:', 14, y);
            doc.text(med.toFixed(2), 80, y);
            y += 7;
            doc.text('Duración moda de sesión:', 14, y);
            doc.text(mod.toFixed(2), 80, y);
            y += 10;
            doc.setFontSize(13);
            doc.text('Resumen:', 14, y);
            y += 6;
            doc.setFontSize(11);
            doc.text(`- Estudiaste más los ${diaMas}.`, 16, y); y += 6;
            doc.text(`- Tu sesión más larga fue de ${sesionLarga.toFixed(2)} horas.`, 16, y); y += 6;
            doc.text(`- La materia que más estudiaste fue ${materiaMas}.`, 16, y); y += 6;
            if (meta > 0) {
                if (totalHoras >= meta) {
                    doc.text(`- ¡Felicidades! Superaste tu meta mensual en ${(totalHoras-meta).toFixed(1)} horas.`, 16, y); y += 6;
                } else {
                    doc.text(`- Llevas un avance del ${avance}% de tu meta mensual.`, 16, y); y += 6;
                }
            }
            y += 4;
            doc.setFontSize(13);
            doc.text('Historial de sesiones:', 14, y);
            y += 2;
            doc.autoTable({
                startY: y,
                head: [['Fecha','Materia','Hora Inicio','Hora Fin','Duración','Comentario']],
                body: sesionesFiltradas.map(s=>[
                    s.fecha.split('T')[0], s.materia, s.horaInicio, s.horaFin, s.duracion, s.notas||''
                ]),
                styles: { fontSize: 10, cellPadding: 2 },
                headStyles: { fillColor: [166,124,82] },
                margin: { left: 14, right: 14 },
                theme: 'grid',
                didDrawPage: function (data) {}
            });
            // Nombre del archivo con fecha y hora
            const fechaHora = new Date().toLocaleString().replace(/\//g,'-').replace(/:/g,'-').replace(/, /g,'_');
            doc.save(`Estadisticas(${fechaHora}).pdf`);
        });
    }
});

// Validar que la hora de fin sea posterior a la de inicio
function validarHoras() {
    const horaInicio = document.getElementById("hora-inicio").value;
    const horaFin = document.getElementById("hora-fin").value;
    
    if (horaInicio && horaFin) {
        const [horaI, minI] = horaInicio.split(':').map(Number);
        const [horaF, minF] = horaFin.split(':').map(Number);
        
        if (horaF < horaI || (horaF === horaI && minF <= minI)) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Horario inválido',
                    text: 'La hora de fin debe ser posterior a la hora de inicio',
                    confirmButtonColor: '#a67c52'
                });
            } else {
                console.warn('Swal is not defined. Please include SweetAlert library.');
                alert('La hora de fin debe ser posterior a la hora de inicio');
            }
            return false;
        }
    }
    return true;
}

// Navegación entre páginas
async function showPage(pageId) {
  pages.forEach((page) => {
    page.classList.remove("active")
  })
  document.getElementById(pageId).classList.add("active")

  navButtons.forEach((btn) => {
    btn.classList.remove("active")
    if (btn.dataset.page === pageId) {
      btn.classList.add("active")
    }
  })

  // Actualizar contenido según la página activa
  // Volvemos a verificar autenticación y cargar sesiones para asegurar
  if (await verificarAutenticacion()) { // Esto recarga la variable sesiones si es necesario
      if (pageId === 'historial') {
          await actualizarHistorial();
      } else if (pageId === 'estadisticas') {
          // Restaurar la vista general de estadísticas al entrar
          const compareWrapper = document.getElementById('compare-periods-wrapper');
          if (compareWrapper) {
              compareWrapper.style.display = 'none';
          }
          await actualizarEstadisticas();
      } else if (pageId === 'perfil') {
           await actualizarPerfilUsuario();
      }
  }
}

// Inicializar navegación
navButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    await showPage(btn.dataset.page)
    // Si navega al perfil, recarga sesiones y actualiza perfil
    if (btn.dataset.page === 'perfil') {
      const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
      sesiones = await obtenerSesionesUsuario(usuarioActual.id);
      await actualizarPerfilUsuario();
    }
  })
})

// Botones de la pantalla de bienvenida
if (startStudyBtn) {
    startStudyBtn.addEventListener("click", async () => {
        await showPage("registro")
    })
}

if (viewStatsBtn) {
    viewStatsBtn.addEventListener("click", async () => {
        await showPage("estadisticas")
        await actualizarEstadisticas()
    })
}

// Manejar la aparición/desaparición del campo de otra materia
if (materiaSelect) {
    materiaSelect.addEventListener("change", () => {
        if (materiaSelect.value === "Otra") {
            otraMateriaGroup.style.display = "block";
            otraMateriaInput.required = true;
        } else {
            otraMateriaGroup.style.display = "none";
            otraMateriaInput.required = false;
        }
    });
}

// Formulario de registro de estudio
if (estudioForm) {
    estudioForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const materia = materiaSelect.value === "Otra" ? otraMateriaInput.value : materiaSelect.value;
        const horaInicio = document.getElementById("hora-inicio").value;
        const horaFin = document.getElementById("hora-fin").value;
        const notas = document.getElementById("notas").value;
        const fechaInput = document.getElementById("fecha").value;

        // Validar que todos los campos requeridos estén llenos
        if (!fechaInput) {
            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    icon: 'error',
                    title: 'Fecha requerida',
                    text: 'Por favor selecciona una fecha',
                    confirmButtonColor: '#a67c52'
                });
            } else {
                alert('Por favor selecciona una fecha');
            }
            return;
        }

        if (materiaSelect.value === "Otra" && !otraMateriaInput.value.trim()) {
            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    icon: 'error',
                    title: 'Materia requerida',
                    text: 'Por favor escribe el nombre de la materia',
                    confirmButtonColor: '#a67c52'
                });
            } else {
                alert('Por favor escribe el nombre de la materia');
            }
            return;
        }

        if (!validarHoras()) {
            return;
        }

        // Crear objeto de fecha usando el valor del input
        const fechaObj = new Date(fechaInput);
        
        // Usar las cadenas de hora de los inputs para el cálculo de duración
        const fechaString = fechaObj.toISOString().split('T')[0];
        const inicio = new Date(`${fechaString}T${horaInicio}`);
        const fin = new Date(`${fechaString}T${horaFin}`);

        // Calcular duración en horas
        const duracionMs = fin - inicio;
        const duracionHoras = duracionMs / (1000 * 60 * 60);
        const duracionFormateada = duracionHoras.toFixed(2);

        // Crear nueva sesión
        const nuevaSesion = {
            materia,
            fecha: fechaObj.toISOString(),
            horaInicio,
            horaFin,
            duracion: duracionFormateada,
            notas
        };

        // Guardar sesión en Firebase
        const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
        await guardarSesion(usuarioActual.id, nuevaSesion);
        // Recargar sesiones y actualizar interfaz
        sesiones = await obtenerSesionesUsuario(usuarioActual.id);
        await actualizarHistorial();
        await actualizarEstadisticas();
        await actualizarPerfilUsuario();

        // Mostrar mensaje de éxito
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                icon: 'success',
                title: '¡Sesión guardada!',
                text: `Has registrado ${duracionFormateada} horas de estudio de ${materia}`,
                confirmButtonColor: '#a67c52'
            });
        } else {
            alert(`Has registrado ${duracionFormateada} horas de estudio de ${materia}`);
        }

        // Resetear formulario
        estudioForm.reset();
        // Restablecer valores predeterminados
        document.getElementById("fecha").value = new Date().toISOString().split('T')[0];
        document.getElementById("hora-inicio").value = "08:00";
        document.getElementById("hora-fin").value = "09:00";
    });
}

// Función para formatear fecha
function formatearFecha(fechaStr) {
  const fecha = new Date(fechaStr);
  return fecha.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: 'UTC' // Especificar UTC si la cadena ISO es UTC, o tu zona horaria si es local con offset
  });
}

// Ajustar filtro de historial para 'semana'
async function actualizarHistorial() {
    if (!historialBody) return;
    let sesionesFiltradas = [...sesiones];
    const filtroFechaValue = filtroFecha ? filtroFecha.value : 'todas';
    const filtroMateriaValue = filtroMateria ? filtroMateria.value : 'todas';
    if (filtroFechaValue === "semana") {
        const hoy = new Date();
        const diaHoy = hoy.getDay();
        const diffADias = (diaHoy === 0) ? 6 : diaHoy - 1;
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - diffADias);
        inicioSemana.setHours(0, 0, 0, 0);
        sesionesFiltradas = sesionesFiltradas.filter(sesion => {
            const fechaSesion = new Date(sesion.fecha);
            return fechaSesion >= inicioSemana;
        });
    } else if (filtroFechaValue === "mes") {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        inicioMes.setHours(0, 0, 0, 0);
        sesionesFiltradas = sesionesFiltradas.filter(sesion => {
            const fechaSesion = new Date(sesion.fecha);
            return fechaSesion >= inicioMes;
        });
    }
    if (filtroMateriaValue !== "todas") {
        sesionesFiltradas = sesionesFiltradas.filter(sesion => sesion.materia === filtroMateriaValue);
    }
    // Ordenar por fecha (más reciente primero) - usar directamente las fechas como objetos Date
    sesionesFiltradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // Limpiar tabla
    historialBody.innerHTML = "";

    // Llenar tabla con datos filtrados
    if (sesionesFiltradas.length === 0) {
        historialBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No hay sesiones registradas</td>
            </tr>
        `;
        if (deleteSelectedBtn) {
            deleteSelectedBtn.style.display = 'none';
        }
    } else {
        sesionesFiltradas.forEach(sesion => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><input type="checkbox" class="session-checkbox" data-id="${sesion.id}"></td>
                <td>${formatearFecha(sesion.fecha)}</td>
                <td>${sesion.materia}</td>
                <td>${sesion.duracion} h</td>
                <td>${sesion.notas || "-"}</td>
                <td>
                    <button class="action-btn delete-btn" data-id="${sesion.id}">
                        Eliminar
                    </button>
                </td>
            `;
            historialBody.appendChild(row);
        });
        
        // Añadir event listeners a los botones de eliminar
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const sessionId = parseInt(this.dataset.id);
                eliminarSesion(sessionId);
            });
        });
    }

    // Actualizar estado del botón de eliminar seleccionados
    actualizarBotonEliminar();
    
    // Actualizar opciones de filtro de materias
    actualizarFiltros();
}

// Función para eliminar una sesión
async function eliminarSesion(sessionId) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '¿Estás seguro?',
            text: 'Esta acción eliminará la sesión seleccionada',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                // Eliminar sesión
                const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
                eliminarSesionFirebase(usuarioActual.id, sessionId);
                
                // Actualizar interfaz
                actualizarHistorial();
                actualizarEstadisticas();
                actualizarPerfilUsuario();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Sesión eliminada',
                    confirmButtonColor: '#a67c52'
                });
            }
        });
    } else {
        console.warn('Swal is not defined. Please include SweetAlert library.');
        if (confirm('¿Estás seguro de que quieres eliminar esta sesión?')) {
            const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
            eliminarSesionFirebase(usuarioActual.id, sessionId);
            
            actualizarHistorial();
            actualizarEstadisticas();
            actualizarPerfilUsuario();
            alert('Sesión eliminada');
        }
    }
}

// Función para actualizar el botón de eliminar seleccionados
function actualizarBotonEliminar() {
    if (!deleteSelectedBtn) return;
    
    const checkboxes = document.querySelectorAll('.session-checkbox:checked');
    deleteSelectedBtn.style.display = checkboxes.length > 0 ? 'block' : 'none';
}

// Event listener para el checkbox "Seleccionar todos"
if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.session-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
        actualizarBotonEliminar();
    });
}

// Event listener para el botón de eliminar seleccionados
if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', async function() {
        const checkboxes = document.querySelectorAll('.session-checkbox:checked');
        if (checkboxes.length === 0) return;

        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: '¿Estás seguro?',
                text: 'Esta acción eliminará las sesiones seleccionadas',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
                const idsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
                for (const id of idsToDelete) {
                    await eliminarSesionFirebase(usuarioActual.id, id);
                }
                
                actualizarHistorial();
                actualizarEstadisticas();
                actualizarPerfilUsuario();
                actualizarBotonEliminar();
            }
        } else {
            console.warn('Swal is not defined. Please include SweetAlert library.');
            if (confirm('¿Estás seguro de que quieres eliminar las sesiones seleccionadas?')) {
                const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
                const idsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
                for (const id of idsToDelete) {
                    await eliminarSesionFirebase(usuarioActual.id, id);
                }
                
                actualizarHistorial();
                actualizarEstadisticas();
                actualizarPerfilUsuario();
                actualizarBotonEliminar();
            }
        }
    });
}

// Función para actualizar las opciones de filtro
function actualizarFiltros() {
    if (!filtroMateria) return;
    
    // Obtener materias únicas
    const materiasUnicas = [...new Set(sesiones.map(sesion => sesion.materia))];

    // Actualizar filtro de materias
    filtroMateria.innerHTML = '<option value="todas">Todas las materias</option>';
    materiasUnicas.forEach(materia => {
        filtroMateria.innerHTML += `<option value="${materia}">${materia}</option>`;
    });
}

// Event listeners para los filtros
if (filtroFecha) {
    filtroFecha.addEventListener('change', actualizarHistorial);
}

if (filtroMateria) {
    filtroMateria.addEventListener('change', actualizarHistorial);
}

// Crear gráfico de horas por día
function crearGraficoDias(horasPorDia) {
    const ctx = document.getElementById("chart-dias");
    if (!ctx) return;
    const ctxCanvas = ctx.getContext("2d");
    if (window.chartDias) {
        window.chartDias.destroy();
    }
    // Generar etiquetas de martes a lunes
    const diasSemanaGraficoEtiquetas = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const hoy = new Date();
    // Calcular el último lunes (hoy si es lunes, o el lunes anterior)
    const diaHoy = hoy.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
    const diasDesdeLunes = (diaHoy + 6) % 7;
    const ultimoLunes = new Date(hoy);
    ultimoLunes.setDate(hoy.getDate() - diasDesdeLunes);
    // Generar fechas de martes a lunes
    const etiquetas = [];
    for (let i = -6; i <= 0; i++) {
        const fecha = new Date(ultimoLunes);
        fecha.setDate(ultimoLunes.getDate() + i);
        const dia = fecha.getDay();
        const nombresCortos = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
        etiquetas.push(nombresCortos[dia]);
    }
    // Ordenar los datos según el orden de etiquetas generadas
    const datosOrdenados = etiquetas.map((et, idx) => {
        const dia = etiquetas[idx].split(' ')[0];
        const mapCortoALargo = {"lun":"Lunes","mar":"Martes","mié":"Miércoles","jue":"Jueves","vie":"Viernes","sáb":"Sábado","dom":"Domingo"};
        return horasPorDia[mapCortoALargo[dia]] || 0;
    });
    window.chartDias = new Chart(ctxCanvas, {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                label: "Horas estudiadas",
                data: datosOrdenados,
                backgroundColor: Array(7).fill('#a67c52'),
                borderColor: Array(7).fill('#8c6142'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Horas",
                        color: '#4a3728'
                    },
                    ticks: {
                        color: '#4a3728',
                        stepSize: 1
                    }
                },
                x: {
                    ticks: {
                        color: '#4a3728'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#4a3728'
                    }
                }
            }
        }
    });
}

// Crear gráfico de distribución de materias
function crearGraficoMaterias() {
    const ctx = document.getElementById("chart-materias");
    if (!ctx) return;
    
    const ctxCanvas = ctx.getContext("2d");

    // Destruir gráfico existente si hay uno
    if (window.chartMaterias) {
        window.chartMaterias.destroy();
    }

    // Agrupar horas por materia
    const horasPorMateria = {};

    sesiones.forEach((sesion) => {
        if (!horasPorMateria[sesion.materia]) {
            horasPorMateria[sesion.materia] = 0;
        }
        horasPorMateria[sesion.materia] += Number.parseFloat(sesion.duracion);
    });

    const materias = Object.keys(horasPorMateria);
    const datos = materias.map((materia) => horasPorMateria[materia]);

    // Colores para el gráfico
    const colores = ["#6c63ff", "#ff6584", "#4caf50", "#ff9800", "#2196f3", "#9c27b0", "#e91e63", "#00bcd4"];

    window.chartMaterias = new Chart(ctxCanvas, {
        type: "pie",
        data: {
            labels: materias,
            datasets: [
                {
                    data: datos,
                    backgroundColor: colores.slice(0, materias.length),
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: "right",
                },
            },
        },
    });
}

// Ajustar estadísticas para 'total de semana' y promedio semanal
async function actualizarEstadisticas() {
    console.log('Sesiones usadas en estadísticas:', sesiones);
    // Mostrar todas las sesiones sin filtrar por mes para depuración
    const sesionesMes = sesiones;
    console.log('Sesiones mostradas en estadísticas (sin filtrar):', sesionesMes);
    const totalSemanaEl = document.getElementById("total-semana");
    const promedioDiarioEl = document.getElementById("promedio-diario");
    const diaMasEl = document.getElementById("dia-mas");
    const diaMenosEl = document.getElementById("dia-menos");
    if (!totalSemanaEl || !promedioDiarioEl || !diaMasEl || !diaMenosEl) return;
    // Total de horas de la semana
    const totalHorasSemana = sesionesMes.reduce((total, sesion) => total + Number.parseFloat(sesion.duracion), 0);
    // Días únicos con sesiones en la semana
    const fechasUnicasSemana = new Set(sesionesMes.map((sesion) => sesion.fecha.split("T")[0]));
    const numeroDiasConSesionesSemana = fechasUnicasSemana.size;
    totalSemanaEl.textContent = `${totalHorasSemana.toFixed(1)} horas`;
    if (numeroDiasConSesionesSemana > 0) {
        const promedioDiario = totalHorasSemana / numeroDiasConSesionesSemana;
        promedioDiarioEl.textContent = `${promedioDiario.toFixed(1)} horas`;
    } else {
        promedioDiarioEl.textContent = "N/A";
    }
    // Días productivos y gráficos generales (todas las sesiones)
    const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const horasPorDia = {};
    diasSemana.forEach((dia) => { horasPorDia[dia] = 0; });
    sesionesMes.forEach((sesion) => {
        const fecha = new Date(sesion.fecha);
        const diaSemana = fecha.getDay();
        const nombreDia = diasSemana[diaSemana];
        horasPorDia[nombreDia] += Number.parseFloat(sesion.duracion);
    });
    let diaMasProductivo = { dia: "Ninguno", horas: 0 };
    let diaMenosProductivo = { dia: "Ninguno", horas: Infinity };
    const diasConSesiones = Object.entries(horasPorDia).filter(([dia, horas]) => horas > 0);
    if (diasConSesiones.length > 0) {
        diasConSesiones.forEach(([dia, horas]) => {
            if (horas > diaMasProductivo.horas) diaMasProductivo = { dia, horas };
            if (horas < diaMenosProductivo.horas) diaMenosProductivo = { dia, horas };
        });
    } else {
        diaMenosProductivo = { dia: "Ninguno", horas: 0 };
    }
    diaMasEl.textContent = `${diaMasProductivo.dia} (${diaMasProductivo.horas.toFixed(1)}h)`;
    diaMenosEl.textContent = `${diaMenosProductivo.dia} (${diaMenosProductivo.horas.toFixed(1)}h)`;
    crearGraficoDias(horasPorDia);
    crearGraficoMateriasPeriodo(sesionesMes);
    crearGraficoDuracionSesiones(sesionesMes);
    const {prom,med,mod} = calcularEstadisticasDuracion(sesionesMes);
    document.getElementById('avg-duration').textContent = prom.toFixed(2);
    document.getElementById('median-duration').textContent = med.toFixed(2);
    document.getElementById('mode-duration').textContent = mod.toFixed(2);
    actualizarProgresoMeta();
    actualizarInformeAutomatico(sesionesMes, obtenerMetaEstudio(), totalHorasSemana, diasSemana, horasPorDia);
}

function actualizarInformeAutomatico(sesionesMes, horasMeta, totalHoras, diasSemana, horasPorDia) {
    const lista = document.getElementById('lista-informe');
    if (!lista) return;
    lista.innerHTML = '';
    // Día más estudiado
    let diaMas = 'Ninguno', maxHoras = 0;
    for (const dia of diasSemana) {
        if (horasPorDia[dia] > maxHoras) {
            maxHoras = horasPorDia[dia];
            diaMas = dia;
        }
    }
    // Sesión más larga
    let sesionLarga = 0;
    sesionesMes.forEach(s => {
        if (parseFloat(s.duracion) > sesionLarga) sesionLarga = parseFloat(s.duracion);
    });
    // Materia más estudiada
    const horasPorMateria = {};
    sesionesMes.forEach(s => {
        if (!horasPorMateria[s.materia]) horasPorMateria[s.materia] = 0;
        horasPorMateria[s.materia] += parseFloat(s.duracion);
    });
    let materiaMas = 'Ninguna', maxMateria = 0;
    Object.entries(horasPorMateria).forEach(([mat, h]) => {
        if (h > maxMateria) { maxMateria = h; materiaMas = mat; }
    });
    // Progreso meta
    let avance = horasMeta > 0 ? (totalHoras / horasMeta) * 100 : 0;
    avance = Math.round(avance);
    // Mensajes
    const hoy = new Date();
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const diasRestantes = (finMes - hoy) / (1000*60*60*24);
    const horasRestantes = Math.max(0, horasMeta - totalHoras);
    const horasPorDiaRest = diasRestantes > 0 ? (horasRestantes / diasRestantes) : 0;
    // Lista
    lista.innerHTML += `<li>Estudiaste más los <b>${diaMas}</b>.</li>`;
    lista.innerHTML += `<li>Tu sesión más larga fue de <b>${sesionLarga.toFixed(2)} horas</b>.</li>`;
    lista.innerHTML += `<li>La materia que más estudiaste fue <b>${materiaMas}</b>.</li>`;
    if (horasMeta > 0) {
        if (totalHoras >= horasMeta) {
            lista.innerHTML += `<li>¡Felicidades! Superaste tu meta mensual en <b>${(totalHoras-horasMeta).toFixed(1)} horas</b>.</li>`;
        } else {
            lista.innerHTML += `<li>Llevas un avance del <b>${avance}%</b> de tu meta mensual.</li>`;
            lista.innerHTML += `<li>Te faltan <b>${Math.ceil(diasRestantes)}</b> días y <b>${horasRestantes.toFixed(1)}</b> horas para lograr tu meta. Necesitas estudiar <b>${horasPorDiaRest.toFixed(2)} horas/día</b>.</li>`;
        }
    }
}

// Función para actualizar el perfil del usuario
async function actualizarPerfilUsuario() {
    const profileSessions = document.getElementById('profile-sessions');
    const profileHours = document.getElementById('profile-hours');
    const profileSubject = document.getElementById('profile-subject');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    if (!profileSessions || !profileHours || !profileSubject || !profileName || !profileEmail) return;
    // Obtener usuario actual desde localStorage
    const usuarioActualRaw = localStorage.getItem('usuarioActual');
    let usuarioActual = null;
    if (usuarioActualRaw === 'admin') {
        usuarioActual = { nombre: 'Administrador', email: 'admin@estudiapp.com', rol: 'admin' };
    } else if (usuarioActualRaw) {
        try {
            const usuarioObj = JSON.parse(usuarioActualRaw);
            if (usuarioObj && usuarioObj.nombre && usuarioObj.email) {
                usuarioActual = usuarioObj;
            } else {
                usuarioActual = { nombre: 'Desconocido', email: 'Desconocido' };
            }
        } catch (e) {
            usuarioActual = { nombre: 'Desconocido', email: 'Desconocido' };
        }
    } else {
        usuarioActual = { nombre: 'Desconocido', email: 'Desconocido' };
    }
    // Actualizar nombre y correo
    profileName.textContent = usuarioActual.nombre;
    profileEmail.textContent = usuarioActual.email;
    // Total de sesiones
    profileSessions.textContent = sesiones.length;
    // Total de horas
    const horasTotales = sesiones.reduce((total, sesion) => {
        return total + parseFloat(sesion.duracion);
    }, 0);
    profileHours.textContent = `${horasTotales.toFixed(1)} h`;
    // Materia favorita (la que más horas tiene)
    const horasPorMateria = {};
    sesiones.forEach(sesion => {
        if (!horasPorMateria[sesion.materia]) {
            horasPorMateria[sesion.materia] = 0;
        }
        horasPorMateria[sesion.materia] += parseFloat(sesion.duracion);
    });
    let materiaFavorita = 'Ninguna';
    let horasMaximas = 0;
    Object.entries(horasPorMateria).forEach(([materia, horas]) => {
        if (horas > horasMaximas) {
            materiaFavorita = materia;
            horasMaximas = horas;
        }
    });
    profileSubject.textContent = materiaFavorita;
}

// 1. Filtrado por rango de fechas personalizado
function filtrarPorRango(sesiones, inicio, fin) {
    if (!inicio && !fin) return sesiones;
    return sesiones.filter(s => {
        const fecha = new Date(s.fecha);
        if (inicio && fecha < new Date(inicio)) return false;
        if (fin && fecha > new Date(fin)) return false;
        return true;
    });
}

// 2. Metas de estudio
async function guardarMetaEstudio(horas) {
    const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
    await db.ref('metas/' + usuarioActual.id).set({ horas });
}
async function obtenerMetaEstudio() {
    const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
    const snapshot = await db.ref('metas/' + usuarioActual.id).once('value');
    const data = snapshot.val();
    return data ? data.horas : 0;
}
function actualizarProgresoMeta() {
    const meta = obtenerMetaEstudio();
    const progressBar = document.getElementById('goal-progress-bar');
    const btnBorrar = document.getElementById('btn-borrar-meta');
    // Calcular total de horas solo del mes actual
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    finMes.setHours(23,59,59,999);
    const sesionesMes = sesiones.filter(s => {
        const fechaSesion = new Date(s.fecha);
        return fechaSesion >= inicioMes && fechaSesion <= finMes;
    });
    const totalHoras = sesionesMes.reduce((a,s)=>a+parseFloat(s.duracion),0);
    if (meta > 0) {
        let porcentaje = Math.round((totalHoras/meta)*100);
        if (porcentaje > 100) porcentaje = 100;
        progressBar.style.width = porcentaje + '%';
        progressBar.setAttribute('aria-valuenow', porcentaje);
        progressBar.setAttribute('aria-valuemax', 100);
        progressBar.textContent = `${totalHoras.toFixed(1)} / ${meta} h (${Math.round((totalHoras/meta)*100)}%)`;
        // Cambiar color si se cumple la meta
        if (totalHoras >= meta) {
            progressBar.classList.remove('bg-primary','bg-warning');
            progressBar.classList.add('bg-success');
            btnBorrar.style.display = 'inline-block';
        } else {
            progressBar.classList.remove('bg-success','bg-warning');
            progressBar.classList.add('bg-primary');
            btnBorrar.style.display = 'none';
        }
    } else {
        progressBar.style.width = '0%';
        progressBar.textContent = 'Sin meta establecida';
        progressBar.classList.remove('bg-success','bg-primary','bg-warning');
        btnBorrar.style.display = 'none';
    }
    // Evento borrar meta
    if (btnBorrar && !btnBorrar.dataset.listener) {
        btnBorrar.addEventListener('click', function() {
            if (confirm('¿Seguro que quieres borrar tu meta actual?')) {
                const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
                db.ref('metas/' + usuarioActual.id).remove();
                document.getElementById('goal-hours').value = '';
                actualizarProgresoMeta();
            }
        });
        btnBorrar.dataset.listener = 'true';
    }
}

// 3. Gráfico por hora del día
function crearGraficoHorasDia(sesiones) {
    const ctx = document.getElementById('chart-horas-dia');
    if (!ctx) return;
    const ctxCanvas = ctx.getContext('2d');
    if (window.chartHorasDia) window.chartHorasDia.destroy();
    const horas = Array(24).fill(0);
    sesiones.forEach(s => {
        const inicio = parseInt(s.horaInicio.split(':')[0]);
        const dur = parseFloat(s.duracion);
        horas[inicio] += dur;
    });
    window.chartHorasDia = new Chart(ctxCanvas, {
        type: 'bar',
        data: {
            labels: Array.from({length:24}, (_,i)=>i+':00'),
            datasets: [{label:'Horas estudiadas',data:horas,backgroundColor:'#4caf50'}]
        },
        options: {responsive:true,maintainAspectRatio:false}
    });
}

// 4. Gráfico de distribución de duración de sesiones
function crearGraficoDuracionSesiones(sesiones) {
    const ctx = document.getElementById('chart-duracion-sesiones');
    if (!ctx) return;
    const ctxCanvas = ctx.getContext('2d');
    if (window.chartDuracionSesiones) window.chartDuracionSesiones.destroy();
    // Etiquetas más claras para los bins
    const bins = {
        'Menor a 1 hora': 0,
        'De 1 a menos de 2 horas': 0,
        'De 2 a menos de 3 horas': 0,
        'Mayor o igual a 3 horas': 0
    };
    sesiones.forEach(s => {
        const d = parseFloat(s.duracion);
        if (d < 1) bins['Menor a 1 hora']++;
        else if (d < 2) bins['De 1 a menos de 2 horas']++;
        else if (d < 3) bins['De 2 a menos de 3 horas']++;
        else bins['Mayor o igual a 3 horas']++;
    });
    window.chartDuracionSesiones = new Chart(ctxCanvas, {
        type: 'pie',
        data: {labels:Object.keys(bins),datasets:[{data:Object.values(bins),backgroundColor:['#6c63ff','#ff6584','#4caf50','#ff9800']}]},
        options: {responsive:true,maintainAspectRatio:true}
    });
}

// 5. Promedio, moda y mediana de duración
function calcularEstadisticasDuracion(sesiones) {
    const duraciones = sesiones.map(s=>parseFloat(s.duracion)).sort((a,b)=>a-b);
    if (duraciones.length === 0) return {prom:0,med:0,mod:0};
    // Promedio
    const prom = duraciones.reduce((a,b)=>a+b,0)/duraciones.length;
    // Mediana
    const mid = Math.floor(duraciones.length/2);
    const med = duraciones.length%2!==0 ? duraciones[mid] : (duraciones[mid-1]+duraciones[mid])/2;
    // Moda
    const freq = {};
    duraciones.forEach(d=>{freq[d]=(freq[d]||0)+1;});
    const mod = duraciones.reduce((a,b)=>freq[a]>freq[b]?a:b);
    return {prom,med,mod};
}

// 6. Exportar datos a CSV
function exportarCSV(sesiones, nombre) {
    const encabezado = 'Fecha,Materia,Hora Inicio,Hora Fin,Duración,Notas\n';
    const filas = sesiones.map(s=>`${s.fecha.split('T')[0]},${s.materia},${s.horaInicio},${s.horaFin},${s.duracion},"${s.notas||''}"`).join('\n');
    const csv = encabezado+filas;
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre+'.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// 7. Comparar periodos de estudio
function compararPeriodos(sesiones, inicio1, fin1, inicio2, fin2) {
    const periodo1 = filtrarPorRango(sesiones, inicio1, fin1);
    const periodo2 = filtrarPorRango(sesiones, inicio2, fin2);
    const suma1 = periodo1.reduce((a,s)=>a+parseFloat(s.duracion),0);
    const suma2 = periodo2.reduce((a,s)=>a+parseFloat(s.duracion),0);
    return {periodo1,periodo2,suma1,suma2};
}

// Actualizar historial con rango personalizado
const oldActualizarHistorial = actualizarHistorial;
actualizarHistorial = async function(){
    if (!historialBody) return;
    let sesionesFiltradas = [...sesiones];
    // Filtros existentes
    const filtroFechaValue = filtroFecha ? filtroFecha.value : 'todas';
    const filtroMateriaValue = filtroMateria ? filtroMateria.value : 'todas';
    // Filtro por rango personalizado
    const inicio = document.getElementById('history-date-start')?.value;
    const fin = document.getElementById('history-date-end')?.value;
    sesionesFiltradas = filtrarPorRango(sesionesFiltradas, inicio, fin);
    // Filtros existentes
    if (filtroFechaValue === "semana") { /* ... igual ... */ }
    else if (filtroFechaValue === "mes") { /* ... igual ... */ }
    if (filtroMateriaValue !== "todas") {
        sesionesFiltradas = sesionesFiltradas.filter(sesion => sesion.materia === filtroMateriaValue);
    }
    // ... resto igual ...
    // (llamar a oldActualizarHistorial si es necesario para mantener lógica previa)
    // ...
}

// Función para mostrar los datos de un periodo en los gráficos principales
function mostrarEstadisticasPeriodo(sesionesPeriodo){
    // Estadísticas resumen
    const totalSemanaEl = document.getElementById("total-semana");
    const promedioDiarioEl = document.getElementById("promedio-diario");
    const diaMasEl = document.getElementById("dia-mas");
    const diaMenosEl = document.getElementById("dia-menos");
    if (!totalSemanaEl || !promedioDiarioEl || !diaMasEl || !diaMenosEl) return;
    const totalHoras = sesionesPeriodo.reduce((total, sesion) => total + Number.parseFloat(sesion.duracion), 0);
    const fechasUnicas = new Set(sesionesPeriodo.map((sesion) => sesion.fecha.split("T")[0]));
    const numeroDiasConSesiones = fechasUnicas.size;
    totalSemanaEl.textContent = `${totalHoras.toFixed(1)} horas`;
    if (numeroDiasConSesiones > 0) {
        const promedioDiario = totalHoras / numeroDiasConSesiones;
        promedioDiarioEl.textContent = `${promedioDiario.toFixed(1)} horas`;
    } else {
        promedioDiarioEl.textContent = "N/A";
    }
    // Días productivos
    const diasSemana = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
    const horasPorDia = {};
    diasSemana.forEach((dia) => { horasPorDia[dia] = 0; });
    sesionesPeriodo.forEach((sesion) => {
        const fecha = new Date(sesion.fecha);
        const diaSemana = fecha.getDay();
        const nombreDia = diasSemana[diaSemana];
        horasPorDia[nombreDia] += Number.parseFloat(sesion.duracion);
    });
    let diaMasProductivo = { dia: "Ninguno", horas: 0 };
    let diaMenosProductivo = { dia: "Ninguno", horas: Infinity };
    const diasConSesiones = Object.entries(horasPorDia).filter(([dia, horas]) => horas > 0);
    if (diasConSesiones.length > 0) {
        diasConSesiones.forEach(([dia, horas]) => {
            if (horas > diaMasProductivo.horas) diaMasProductivo = { dia, horas };
            if (horas < diaMenosProductivo.horas) diaMenosProductivo = { dia, horas };
        });
    } else {
        diaMenosProductivo = { dia: "Ninguno", horas: 0 };
    }
    diaMasEl.textContent = `${diaMasProductivo.dia} (${diaMasProductivo.horas.toFixed(1)}h)`;
    diaMenosEl.textContent = `${diaMenosProductivo.dia} (${diaMenosProductivo.horas.toFixed(1)}h)`;
    // Gráficos principales
    crearGraficoDias(horasPorDia);
    crearGraficoMateriasPeriodo(sesionesPeriodo);
}
// Gráfico de materias para un periodo
function crearGraficoMateriasPeriodo(sesionesPeriodo){
    const ctx = document.getElementById("chart-materias");
    if (!ctx) return;
    const ctxCanvas = ctx.getContext("2d");
    if (window.chartMaterias) window.chartMaterias.destroy();
    const horasPorMateria = {};
    sesionesPeriodo.forEach((sesion) => {
        if (!horasPorMateria[sesion.materia]) horasPorMateria[sesion.materia] = 0;
        horasPorMateria[sesion.materia] += Number.parseFloat(sesion.duracion);
    });
    const materias = Object.keys(horasPorMateria);
    const datos = materias.map((materia) => horasPorMateria[materia]);
    const colores = ["#6c63ff", "#ff6584", "#4caf50", "#ff9800", "#2196f3", "#9c27b0", "#e91e63", "#00bcd4"];
    window.chartMaterias = new Chart(ctxCanvas, {
        type: "pie",
        data: {
            labels: materias,
            datasets: [
                {
                    data: datos,
                    backgroundColor: colores.slice(0, materias.length),
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: "right",
                },
            },
        },
    });
}

// 3) Exportar historial y estadísticas según los filtros aplicados
const btnExportHistory = document.getElementById('btn-export-history');
if(btnExportHistory){
    btnExportHistory.addEventListener('click',()=>{
        // Exportar solo las sesiones filtradas actualmente en el historial
        const filtroFechaValue = filtroFecha ? filtroFecha.value : 'todas';
        const filtroMateriaValue = filtroMateria ? filtroMateria.value : 'todas';
        let sesionesFiltradas = [...sesiones];
        if (filtroFechaValue === "semana") {
            const hoy = new Date();
            const diaHoy = hoy.getDay();
            const diffADias = (diaHoy === 0) ? 6 : diaHoy - 1;
            const inicioSemana = new Date(hoy);
            inicioSemana.setDate(hoy.getDate() - diffADias);
            inicioSemana.setHours(0, 0, 0, 0);
            sesionesFiltradas = sesionesFiltradas.filter(sesion => {
                const fechaSesion = new Date(sesion.fecha);
                return fechaSesion >= inicioSemana;
            });
        } else if (filtroFechaValue === "mes") {
            const hoy = new Date();
            const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            inicioMes.setHours(0, 0, 0, 0);
            sesionesFiltradas = sesionesFiltradas.filter(sesion => {
                const fechaSesion = new Date(sesion.fecha);
                return fechaSesion >= inicioMes;
            });
        }
        if (filtroMateriaValue !== "todas") {
            sesionesFiltradas = sesionesFiltradas.filter(sesion => sesion.materia === filtroMateriaValue);
        }
        exportarCSV(sesionesFiltradas,'historial_estudio');
    });
}
const btnExportStats = document.getElementById('btn-export-stats');
if(btnExportStats){
    btnExportStats.addEventListener('click',()=>{
        // Exportar solo las sesiones filtradas actualmente en estadísticas (por rango de fechas)
        const inicio = document.getElementById('stats-date-start')?.value;
        const fin = document.getElementById('stats-date-end')?.value;
        let sesionesFiltradas = filtrarPorRango(sesiones, inicio, fin);
        exportarCSV(sesionesFiltradas,'estadisticas_estudio');
    });
}

// Cuando se cambie el filtro de fechas en estadísticas, restaurar la vista general
const statsStart = document.getElementById('stats-date-start');
const statsEnd = document.getElementById('stats-date-end');
if(statsStart && statsEnd){
    [statsStart,statsEnd].forEach(el=>el.addEventListener('change',()=>{
        const compareWrapper = document.getElementById('compare-periods-wrapper');
        if (compareWrapper) {
            compareWrapper.style.display = 'none';
        }
        actualizarEstadisticas();
    }));
}
