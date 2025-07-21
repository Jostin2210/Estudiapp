// Funciones para el panel de administrador

// Verificar si el usuario es administrador
function verificarAdmin() {
    const usuarioActualRaw = localStorage.getItem('usuarioActual');
    if (usuarioActualRaw === 'admin') {
        // Es el admin local
        return true;
    }
    const usuarioActual = JSON.parse(usuarioActualRaw);
    if (!usuarioActual || usuarioActual.rol !== 'admin') {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// --- INICIO: Firebase Realtime Database ---
// Asume que ya está inicializado firebase y db en el HTML

// Guardar usuario
async function guardarUsuario(usuario) {
    await db.ref('usuarios/' + usuario.id).set(usuario);
}
// Obtener todos los usuarios
async function obtenerUsuarios() {
    const snapshot = await db.ref('usuarios').once('value');
    const data = snapshot.val();
    return data ? Object.values(data) : [];
}
// Obtener todas las sesiones de todos los usuarios
async function obtenerTodasLasSesiones() {
    const snapshot = await db.ref('sesiones').once('value');
    const data = snapshot.val();
    let todasLasSesiones = [];
    if (data) {
        Object.entries(data).forEach(([usuarioId, sesionesUsuario]) => {
            Object.entries(sesionesUsuario).forEach(([sesionId, sesion]) => {
                todasLasSesiones.push({ ...sesion, usuarioId, id: sesionId });
            });
        });
    }
    console.log('Sesiones globales para admin:', todasLasSesiones);
    return todasLasSesiones;
}
// Eliminar usuario
async function eliminarUsuarioFirebase(userId) {
    await db.ref('usuarios/' + userId).remove();
    await db.ref('sesiones/' + userId).remove();
}
// Guardar meta global
async function guardarMetaEstudioGlobal(horas) {
    await db.ref('meta_global').set({ horas });
}
// Obtener meta global
async function obtenerMetaEstudioGlobal() {
    const snapshot = await db.ref('meta_global').once('value');
    const data = snapshot.val();
    return data ? data.horas : 0;
}
// --- FIN: Firebase Realtime Database ---

// Elementos DOM de las páginas y navegación
const pages = document.querySelectorAll('.page');
const navButtons = document.querySelectorAll('.nav-btn');

// Función para mostrar una página específica
function showPage(pageId) {
    pages.forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');

    navButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pageId) {
            btn.classList.add('active');
        }
    });

    // Cargar contenido específico de la página
    if (pageId === 'dashboard') {
        actualizarDashboard();
    } else if (pageId === 'usuarios') {
        actualizarTablaUsuarios();
    } else if (pageId === 'estadisticas-admin') {
        crearGraficoGlobalDias();
        crearGraficoTopUsuarios();
    }
}

// Listener para cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    if (verificarAdmin()) {
        // Configurar navegación
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                showPage(btn.dataset.page);
            });
        });

        // Mostrar la página inicial (Dashboard por defecto)
        showPage('dashboard');

        // Configurar botón de cerrar sesión
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                localStorage.removeItem('usuarioActual');
                window.location.href = 'login.html';
            });
        }

        // Inicializar búsqueda de usuarios
        const buscarUsuario = document.getElementById('buscar-usuario');
        if (buscarUsuario) {
            buscarUsuario.addEventListener('input', function() {
                const termino = this.value.toLowerCase();
                const filas = document.querySelectorAll('#usuarios-body tr');

                filas.forEach(fila => {
                    const nombre = fila.cells[1].textContent.toLowerCase();
                    const email = fila.cells[2].textContent.toLowerCase();

                    if (nombre.includes(termino) || email.includes(termino)) {
                        fila.style.display = '';
                    } else {
                        fila.style.display = 'none';
                    }
                });
            });
        }

        // Inicializar filtro de periodo para estadísticas
        const filtroPeriodo = document.getElementById('filtro-periodo');
        if (filtroPeriodo) {
            filtroPeriodo.value = 'mes'; // Valor por defecto
            filtroPeriodo.addEventListener('change', function() {
                crearGraficoGlobalDias();
                crearGraficoTopUsuarios();
            });
        }

        // Inicializar filtro de usuario para estadísticas
        const filtroUsuario = document.getElementById('filtro-usuario');
        if (filtroUsuario) {
            // Poblar opciones de usuarios
            (async function() {
                const usuarios = await obtenerUsuarios(); // Await para obtener usuarios
                usuarios.forEach(usuario => {
                    const option = document.createElement('option');
                    option.value = usuario.id;
                    option.textContent = usuario.nombre;
                    filtroUsuario.appendChild(option);
                });
            })();
            filtroUsuario.addEventListener('change', function() {
                crearGraficoGlobalDias();
                crearGraficoTopUsuarios();
            });
        }

        // Metas de estudio global
        const goalForm = document.getElementById('admin-goal-form');
        if(goalForm){
            goalForm.addEventListener('submit', async function(e){
                e.preventDefault();
                const horas = Number(document.getElementById('admin-goal-hours').value);
                await guardarMetaEstudioGlobal(horas);
                actualizarEstadisticasGlobales();
            });
            // Mostrar meta guardada
            (async function() {
                document.getElementById('admin-goal-hours').value = await obtenerMetaEstudioGlobal()||'';
            })();
        }

        // Exportar estadísticas globales
        const btnExportStats = document.getElementById('btn-admin-export-stats');
        if(btnExportStats){
            btnExportStats.addEventListener('click', async ()=>{
                exportarCSVGlobal(await obtenerTodasLasSesiones(),'estadisticas_globales');
            });
        }

        // Filtros de rango de fechas en estadísticas globales
        const adminStart = document.getElementById('admin-date-start');
        const adminEnd = document.getElementById('admin-date-end');
        if(adminStart && adminEnd){
            [adminStart,adminEnd].forEach(el=>el.addEventListener('change',actualizarEstadisticasGlobales));
        }
    }
});

// Actualizar el dashboard
async function actualizarDashboard() {
    const usuarios = await obtenerUsuarios();
    const todasLasSesiones = await obtenerTodasLasSesiones();
    
    // Actualizar estadísticas básicas
    document.getElementById('total-usuarios').textContent = usuarios.length;
    document.getElementById('total-sesiones').textContent = todasLasSesiones.length;
    
    // Calcular horas totales
    const horasTotales = todasLasSesiones.reduce((total, sesion) => {
        return total + parseFloat(sesion.duracion || 0);
    }, 0);
    
    document.getElementById('total-horas').textContent = `${horasTotales.toFixed(1)} h`;
    
    // Encontrar materia más popular
    const materiasPorHoras = {};
    todasLasSesiones.forEach(sesion => {
        if (!materiasPorHoras[sesion.materia]) {
            materiasPorHoras[sesion.materia] = 0;
        }
        materiasPorHoras[sesion.materia] += parseFloat(sesion.duracion || 0);
    });
    
    let materiaMasPopular = { materia: 'Ninguna', horas: 0 };
    
    Object.entries(materiasPorHoras).forEach(([materia, horas]) => {
        if (horas > materiaMasPopular.horas) {
            materiaMasPopular = { materia, horas };
        }
    });
    
    document.getElementById('materia-popular').textContent = materiaMasPopular.materia;
    
    // Crear gráficos
    crearGraficoActividad();
    crearGraficoMateriasGlobal();
}

// Crear gráfico de actividad de usuarios
function crearGraficoActividad() {
    const ctx = document.getElementById('chart-actividad').getContext('2d');
    
    // Obtener datos de los últimos 7 días
    const hoy = new Date();
    const fechas = [];
    const datos = [];
    (async function() {
        for (let i = 7; i >= 0; i--) {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() - i);
            fechas.push(fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }));
            // Sumar horas estudiadas solo de estudiantes para esta fecha
            const fechaStr = fecha.toISOString().split('T')[0];
            // Filtrar solo usuarios que no sean admin
            const usuarios = await obtenerUsuarios(); // Await para obtener usuarios
            let horasDia = 0;
            for (const usuario of usuarios) {
                if (usuario.rol !== 'admin') {
                    const sesionesUsuario = JSON.parse(localStorage.getItem(`sesiones_${usuario.id}`)) || [];
                    sesionesUsuario.forEach(sesion => {
                        if (sesion.fecha.split('T')[0] === fechaStr) {
                            horasDia += parseFloat(sesion.duracion || 0);
                        }
                    });
                }
            }
            datos.push(horasDia);
        }
        // Destruir gráfico existente si hay uno
        if (window.chartActividad) {
            window.chartActividad.destroy();
        }
        window.chartActividad = new Chart(ctx, {
            type: 'line',
            data: {
                labels: fechas,
                datasets: [{
                    label: 'Horas estudiadas',
                    data: datos,
                    backgroundColor: 'rgba(166, 124, 82, 0.2)',
                    borderColor: '#a67c52',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    })();
}

// Crear gráfico de distribución global de materias
function crearGraficoMateriasGlobal() {
    const ctx = document.getElementById('chart-materias-global').getContext('2d');
    
    // Agrupar horas por materia
    const horasPorMateria = {};
    (async function() {
        const sesiones = await obtenerTodasLasSesiones();
        sesiones.forEach(sesion => {
            if (!horasPorMateria[sesion.materia]) {
                horasPorMateria[sesion.materia] = 0;
            }
            horasPorMateria[sesion.materia] += parseFloat(sesion.duracion || 0);
        });
        const materias = Object.keys(horasPorMateria);
        const datos = materias.map(materia => horasPorMateria[materia]);
    
        // Colores para el gráfico
        const colores = [
            '#6c63ff', '#ff6584', '#4caf50', '#ff9800', 
            '#2196f3', '#9c27b0', '#e91e63', '#00bcd4'
        ];
    
        // Destruir gráfico existente si hay uno
        if (window.chartMateriasGlobal) {
            window.chartMateriasGlobal.destroy();
        }
        window.chartMateriasGlobal = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: materias,
                datasets: [{
                    data: datos,
                    backgroundColor: colores.slice(0, materias.length),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    })();
}

// Actualizar tabla de usuarios
async function actualizarTablaUsuarios() {
    const usuarios = await obtenerUsuarios();
    const todasLasSesiones = await obtenerTodasLasSesiones();
    const tbody = document.getElementById('usuarios-body');
    // Limpiar tabla
    tbody.innerHTML = '';
    // Llenar tabla con datos
    for (const usuario of usuarios) {
        // Contar solo las sesiones de este usuario
        const sesionesUsuario = todasLasSesiones.filter(s => String(s.usuarioId) === String(usuario.id));
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${usuario.id}</td>
            <td>${usuario.nombre}</td>
            <td>${usuario.email}</td>
            <td><span class="badge ${usuario.rol === 'admin' ? 'bg-danger' : 'bg-primary'}">${usuario.rol}</span></td>
            <td>${new Date(usuario.fechaRegistro).toLocaleDateString('es-ES')}</td>
            <td>${sesionesUsuario.length}</td>
            <td>
                <button class="btn btn-sm btn-info ver-usuario" data-id="${usuario.id}">
                    <i class="fas fa-eye"></i>
                </button>
                ${usuario.rol !== 'admin' ? `
                <button class="btn btn-sm btn-warning cambiar-rol" data-id="${usuario.id}">
                    <i class="fas fa-user-shield"></i>
                </button>
                <button class="btn btn-sm btn-danger eliminar-usuario" data-id="${usuario.id}">
                    <i class="fas fa-trash"></i>
                </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(row);
    }
    // Añadir event listeners a los botones
    document.querySelectorAll('.ver-usuario').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = parseInt(this.dataset.id);
            verDetallesUsuario(userId);
        });
    });
    document.querySelectorAll('.cambiar-rol').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = parseInt(this.dataset.id);
            await cambiarRolUsuario(userId);
        });
    });
    document.querySelectorAll('.eliminar-usuario').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = parseInt(this.dataset.id);
            await eliminarUsuario(userId);
        });
    });
}

// Ver detalles de un usuario
async function verDetallesUsuario(userId) {
    const usuarios = await obtenerUsuarios();
    const usuario = usuarios.find(u => u.id === userId);
    if (!usuario) return;
    // Obtener todas las sesiones globales y filtrar solo las del usuario
    const todasLasSesiones = await obtenerTodasLasSesiones();
    const sesionesUsuario = todasLasSesiones.filter(s => String(s.usuarioId) === String(usuario.id));
    // Calcular estadísticas
    const horasTotales = sesionesUsuario.reduce((total, sesion) => {
        return total + parseFloat(sesion.duracion || 0);
    }, 0);
    // Encontrar materia favorita
    const materiasPorHoras = {};
    sesionesUsuario.forEach(sesion => {
        if (!materiasPorHoras[sesion.materia]) {
            materiasPorHoras[sesion.materia] = 0;
        }
        materiasPorHoras[sesion.materia] += parseFloat(sesion.duracion || 0);
    });
    let materiaFavorita = 'Ninguna';
    let horasMaximas = 0;
    Object.entries(materiasPorHoras).forEach(([materia, horas]) => {
        if (horas > horasMaximas) {
            materiaFavorita = materia;
            horasMaximas = horas;
        }
    });
    // Mostrar modal con detalles
    Swal.fire({
        title: `Detalles de ${usuario.nombre}`,
        html: `
            <div class="user-details">
                <p><strong>Email:</strong> ${usuario.email}</p>
                <p><strong>Rol:</strong> ${usuario.rol}</p>
                <p><strong>Fecha de registro:</strong> ${new Date(usuario.fechaRegistro).toLocaleDateString('es-ES')}</p>
                <p><strong>Sesiones registradas:</strong> ${sesionesUsuario.length}</p>
                <p><strong>Horas totales:</strong> ${horasTotales.toFixed(1)} h</p>
                <p><strong>Materia favorita:</strong> ${materiaFavorita}</p>
            </div>
        `,
        confirmButtonColor: '#a67c52'
    });
}

// Cambiar rol de un usuario
async function cambiarRolUsuario(userId) {
    const usuarios = await obtenerUsuarios();
    const usuarioIndex = usuarios.findIndex(u => u.id === userId);
    if (usuarioIndex === -1) return;
    const usuario = usuarios[usuarioIndex];
    Swal.fire({
        title: `Cambiar rol de ${usuario.nombre}`,
        text: usuario.rol === 'admin' ? '¿Quitar permisos de administrador?' : '¿Hacer administrador?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#a67c52',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, cambiar rol',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Cambiar rol
            usuarios[usuarioIndex].rol = usuario.rol === 'admin' ? 'usuario' : 'admin';
            await guardarUsuario(usuarios[usuarioIndex]); // Guardar usuario actualizado
            // Actualizar tabla
            actualizarTablaUsuarios();
            Swal.fire({
                icon: 'success',
                title: 'Rol actualizado',
                confirmButtonColor: '#a67c52'
            });
        }
    });
}

// Eliminar un usuario
async function eliminarUsuario(userId) {
    const usuarios = await obtenerUsuarios();
    const usuarioIndex = usuarios.findIndex(u => u.id === userId);
    if (usuarioIndex === -1) return;
    const usuario = usuarios[usuarioIndex];
    Swal.fire({
        title: `Eliminar a ${usuario.nombre}`,
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Eliminar usuario
            await eliminarUsuarioFirebase(userId);
            // Actualizar tabla y dashboard
            actualizarTablaUsuarios();
            actualizarDashboard();
            Swal.fire({
                icon: 'success',
                title: 'Usuario eliminado',
                confirmButtonColor: '#a67c52'
            });
        }
    });
}

// Crear gráfico de horas por día (global)
async function crearGraficoGlobalDias() {
    const ctx = document.getElementById('chart-global-dias').getContext('2d');
    const filtroPeriodo = document.getElementById('filtro-periodo').value;
    const filtroUsuario = document.getElementById('filtro-usuario')?.value || 'todos';
    let todasLasSesiones = await obtenerTodasLasSesiones(); // Await para obtener sesiones
    // Filtrar por usuario si corresponde
    if (filtroUsuario !== 'todos') {
        todasLasSesiones = todasLasSesiones.filter(s => s.usuarioId == filtroUsuario);
    }
    // Obtener datos según el filtro seleccionado
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    inicioMes.setHours(0,0,0,0);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    finMes.setHours(23,59,59,999);
    let sesionesFiltradas = todasLasSesiones.filter(sesion => {
        const fechaSesion = new Date(sesion.fecha);
        return fechaSesion >= inicioMes && fechaSesion <= finMes;
    });
    // Agrupar horas por día de la semana
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const horasPorDia = {
        'Lunes': 0,
        'Martes': 0,
        'Miércoles': 0,
        'Jueves': 0,
        'Viernes': 0,
        'Sábado': 0,
        'Domingo': 0
    };
    sesionesFiltradas.forEach(sesion => {
        const fecha = new Date(sesion.fecha);
        const dia = diasSemana[fecha.getDay()];
        horasPorDia[dia] += parseFloat(sesion.duracion || 0);
    });
    // Generar etiquetas cortas y ordenadas igual que en estudiantes
    const hoy2 = new Date();
    const diaHoy = hoy2.getDay();
    const diasDesdeLunes = (diaHoy + 6) % 7;
    const ultimoLunes = new Date(hoy2);
    ultimoLunes.setDate(hoy2.getDate() - diasDesdeLunes);
    const nombresCortos = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
    const mapCortoALargo = {"lun":"Lunes","mar":"Martes","mié":"Miércoles","jue":"Jueves","vie":"Viernes","sáb":"Sábado","dom":"Domingo"};
    const etiquetas = [];
    for (let i = -6; i <= 0; i++) {
        const fecha = new Date(ultimoLunes);
        fecha.setDate(ultimoLunes.getDate() + i);
        const dia = fecha.getDay();
        etiquetas.push(nombresCortos[dia]);
    }
    const datosOrdenados = etiquetas.map(et => horasPorDia[mapCortoALargo[et]] || 0);
    // Destruir gráfico existente si hay uno
    if (window.chartGlobalDias) {
        window.chartGlobalDias.destroy();
    }
    window.chartGlobalDias = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Horas estudiadas',
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
                    beginAtZero: true
                }
            }
        }
    });
}

// Crear gráfico de top usuarios
async function crearGraficoTopUsuarios() {
    const ctx = document.getElementById('chart-top-usuarios').getContext('2d');
    // Obtener datos según el filtro seleccionado
    const filtroPeriodo = document.getElementById('filtro-periodo').value;
    const filtroUsuario = document.getElementById('filtro-usuario')?.value || 'todos';
    const usuarios = await obtenerUsuarios();
    let todasLasSesiones = await obtenerTodasLasSesiones();
    // Filtrar por usuario si corresponde
    if (filtroUsuario !== 'todos') {
        todasLasSesiones = todasLasSesiones.filter(s => String(s.usuarioId) === String(filtroUsuario));
    }
    // Filtrar por periodo
    const hoy = new Date();
    let sesionesFiltradas = todasLasSesiones;
    if (filtroPeriodo === 'mes') {
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        finMes.setHours(23,59,59,999);
        sesionesFiltradas = todasLasSesiones.filter(sesion => {
            const fechaSesion = new Date(sesion.fecha);
            return fechaSesion >= inicioMes && fechaSesion <= finMes;
        });
    } else if (filtroPeriodo === 'trimestre') {
        const inicioTrimestre = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        finMes.setHours(23,59,59,999);
        sesionesFiltradas = todasLasSesiones.filter(sesion => {
            const fechaSesion = new Date(sesion.fecha);
            return fechaSesion >= inicioTrimestre && fechaSesion <= finMes;
        });
    }
    // Calcular horas totales por usuario
    const horasPorUsuario = {};
    sesionesFiltradas.forEach(sesion => {
        if (!horasPorUsuario[sesion.usuarioId]) {
            const usuario = usuarios.find(u => String(u.id) === String(sesion.usuarioId));
            horasPorUsuario[sesion.usuarioId] = {
                id: sesion.usuarioId,
                nombre: usuario ? usuario.nombre : 'Usuario desconocido',
                horas: 0
            };
        }
        horasPorUsuario[sesion.usuarioId].horas += parseFloat(sesion.duracion || 0);
    });
    // Convertir a array y ordenar por horas (descendente)
    const usuariosOrdenados = Object.values(horasPorUsuario).sort((a, b) => b.horas - a.horas);
    // Tomar los 5 primeros
    const topUsuarios = usuariosOrdenados.slice(0, 5);
    const nombres = topUsuarios.map(u => u.nombre);
    const horas = topUsuarios.map(u => u.horas);
    // Destruir gráfico existente si hay uno
    if (window.chartTopUsuarios) {
        window.chartTopUsuarios.destroy();
    }
    window.chartTopUsuarios = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: nombres,
            datasets: [{
                label: 'Horas totales',
                data: horas,
                backgroundColor: [
                    '#6c63ff', '#ff6584', '#4caf50', 
                    '#ff9800', '#2196f3'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 1. Filtrado por rango de fechas personalizado
async function filtrarPorRangoGlobal(sesiones, inicio, fin) {
    if (!inicio && !fin) return sesiones;
    return sesiones.filter(s => {
        const fecha = new Date(s.fecha);
        if (inicio && fecha < new Date(inicio)) return false;
        if (fin && fecha > new Date(fin)) return false;
        return true;
    });
}

// 2. Metas de estudio global
async function actualizarProgresoMetaGlobal(totalHoras) {
    const meta = await obtenerMetaEstudioGlobal();
    const goalProgress = document.getElementById('admin-goal-progress');
    if (meta > 0) {
        goalProgress.textContent = `Progreso: ${totalHoras.toFixed(1)} / ${meta} h (${((totalHoras/meta)*100).toFixed(0)}%)`;
    } else {
        goalProgress.textContent = 'Sin meta establecida';
    }
}

// 3. Gráfico global por hora del día
async function crearGraficoAdminHorasDia(sesiones) {
    const ctx = document.getElementById('chart-admin-horas-dia');
    if (!ctx) return;
    const ctxCanvas = ctx.getContext('2d');
    if (window.chartAdminHorasDia) window.chartAdminHorasDia.destroy();
    const horas = Array(24).fill(0);
    sesiones.forEach(s => {
        const inicio = parseInt(s.horaInicio.split(':')[0]);
        const dur = parseFloat(s.duracion);
        horas[inicio] += dur;
    });
    window.chartAdminHorasDia = new Chart(ctxCanvas, {
        type: 'bar',
        data: {
            labels: Array.from({length:24}, (_,i)=>i+':00'),
            datasets: [{label:'Horas estudiadas',data:horas,backgroundColor:'#2196f3'}]
        },
        options: {responsive:true,maintainAspectRatio:false}
    });
}

// 4. Gráfico global de distribución de duración de sesiones
async function crearGraficoAdminDuracionSesiones(sesiones) {
    const ctx = document.getElementById('chart-admin-duracion-sesiones');
    if (!ctx) return;
    const ctxCanvas = ctx.getContext('2d');
    if (window.chartAdminDuracionSesiones) window.chartAdminDuracionSesiones.destroy();
    const bins = {'<1h':0,'1-2h':0,'2-3h':0,'>3h':0};
    sesiones.forEach(s => {
        const d = parseFloat(s.duracion);
        if (d < 1) bins['<1h']++;
        else if (d < 2) bins['1-2h']++;
        else if (d < 3) bins['2-3h']++;
        else bins['>3h']++;
    });
    window.chartAdminDuracionSesiones = new Chart(ctxCanvas, {
        type: 'pie',
        data: {labels:Object.keys(bins),datasets:[{data:Object.values(bins),backgroundColor:['#6c63ff','#ff6584','#4caf50','#ff9800']}]},
        options: {responsive:true,maintainAspectRatio:true}
    });
}

// 5. Promedio, moda y mediana de duración global
async function calcularEstadisticasDuracionGlobal(sesiones) {
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

// 6. Exportar datos a CSV global
async function exportarCSVGlobal(sesiones, nombre) {
    const encabezado = 'Usuario,Fecha,Materia,Hora Inicio,Hora Fin,Duración,Notas\n';
    const filas = sesiones.map(s=>`${s.usuarioId},${s.fecha.split('T')[0]},${s.materia},${s.horaInicio},${s.horaFin},${s.duracion},"${s.notas||''}"`).join('\n');
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

// Actualizar estadísticas globales con rango personalizado y mostrar nuevas métricas
const oldActualizarEstadisticasGlobales = actualizarEstadisticasGlobales;
actualizarEstadisticasGlobales = async function(){
    // Filtro por rango personalizado
    const inicio = document.getElementById('admin-date-start')?.value;
    const fin = document.getElementById('admin-date-end')?.value;
    let sesionesFiltradas = await filtrarPorRangoGlobal(await obtenerTodasLasSesiones(), inicio, fin);
    // Metas de estudio global
    const totalHoras = sesionesFiltradas.reduce((a,s)=>a+parseFloat(s.duracion),0);
    await actualizarProgresoMetaGlobal(totalHoras);
    // Gráficos nuevos
    await crearGraficoAdminHorasDia(sesionesFiltradas);
    await crearGraficoAdminDuracionSesiones(sesionesFiltradas);
    // Estadísticas adicionales
    const {prom,med,mod} = await calcularEstadisticasDuracionGlobal(sesionesFiltradas);
    document.getElementById('admin-avg-duration').textContent = prom.toFixed(2);
    document.getElementById('admin-median-duration').textContent = med.toFixed(2);
    document.getElementById('admin-mode-duration').textContent = mod.toFixed(2);
    // ... resto igual ...
}