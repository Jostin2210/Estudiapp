// Funciones de autenticación para EstudiApp

// --- INICIO: Firebase Realtime Database ---
// Asume que ya está inicializado firebase y db en el HTML

// Guardar usuario en Firebase
async function guardarUsuario(usuario) {
    await db.ref('usuarios/' + usuario.id).set(usuario);
}
// Obtener todos los usuarios
async function obtenerUsuarios() {
    const snapshot = await db.ref('usuarios').once('value');
    const data = snapshot.val();
    return data ? Object.values(data) : [];
}
// Buscar usuario por email
async function buscarUsuarioPorEmail(email) {
    const usuarios = await obtenerUsuarios();
    return usuarios.find(user => user.email === email);
}
// Obtener usuario por ID
async function obtenerUsuarioPorId(id) {
    const snapshot = await db.ref('usuarios/' + id).once('value');
    return snapshot.exists() ? snapshot.val() : null;
}
// Actualizar usuario
async function actualizarUsuario(usuario) {
    await db.ref('usuarios/' + usuario.id).set(usuario);
}
// --- FIN: Firebase Realtime Database ---

// Verificar si el usuario está autenticado
async function verificarAutenticacion() {
    const usuarioActualId = localStorage.getItem('usuarioActual');
    if (!usuarioActualId) {
        const paginaActual = window.location.pathname.split('/').pop();
        if (paginaActual !== 'login.html' && paginaActual !== 'register.html') {
            window.location.href = 'login.html';
        }
        return false;
    }
    // Si es admin local
    if (usuarioActualId === 'admin') {
        const paginaActual = window.location.pathname.split('/').pop();
        if (paginaActual !== 'admin.html') {
            window.location.href = 'admin.html';
            return false;
        }
        actualizarInterfazUsuario({ nombre: 'Administrador', email: 'admin@estudiapp.com', rol: 'admin' });
        return true;
    }
    // Si no es admin, busca en Firebase
    const usuarioActual = await obtenerUsuarioPorId(usuarioActualId);
    if (!usuarioActual) {
        localStorage.removeItem('usuarioActual');
        window.location.href = 'login.html';
        return false;
    }
    const paginaActual = window.location.pathname.split('/').pop();
    if ((paginaActual === 'login.html' || paginaActual === 'register.html') && usuarioActual) {
        window.location.href = 'index.html';
        return true;
    }
    if (paginaActual === 'admin.html' && usuarioActual.rol !== 'admin') {
        window.location.href = 'index.html';
        return false;
    }
    actualizarInterfazUsuario(usuarioActual);
    return true;
}

// Actualizar la interfaz con los datos del usuario
function actualizarInterfazUsuario(usuario) {
    // Si estamos en la página principal
    if (document.getElementById('profile-name')) {
        document.getElementById('profile-name').textContent = usuario.nombre;
        document.getElementById('profile-email').textContent = usuario.email;
        
        const fechaRegistro = new Date(usuario.fechaRegistro);
        document.getElementById('profile-joined').textContent = `Miembro desde: ${fechaRegistro.toLocaleDateString('es-ES')}`;
        
        // Actualizar imagen de perfil
        const profileAvatar = document.querySelector('.profile-avatar');
        if (usuario.fotoPerfil) {
            profileAvatar.innerHTML = `<img src="${usuario.fotoPerfil}" alt="Foto de perfil">`;
        } else {
            profileAvatar.innerHTML = '<i class="fas fa-user-circle"></i>';
        }
    }
}

// Inicializar usuarios si no existen (solo crea admin si no hay usuarios en la base)
async function inicializarUsuarios() {
    const usuarios = await obtenerUsuarios();
    if (usuarios.length === 0) {
        const adminUser = {
            id: 1,
            nombre: 'Administrador',
            email: 'admin@estudiapp.com',
            password: 'admin123',
            rol: 'admin',
            fechaRegistro: new Date().toISOString()
        };
        await guardarUsuario(adminUser);
    }
}

// Registrar usuario
async function registrarUsuario(nombre, email, password) {
    const usuarios = await obtenerUsuarios();
    if (usuarios.some(user => user.email === email)) {
        return { exito: false, mensaje: 'Este correo electrónico ya está registrado' };
    }
    const nuevoUsuario = {
        id: Date.now(),
        nombre,
        email,
        password,
        rol: 'usuario',
        fechaRegistro: new Date().toISOString()
    };
    await guardarUsuario(nuevoUsuario);
    localStorage.setItem('usuarioActual', JSON.stringify(nuevoUsuario));
    return { exito: true, usuario: nuevoUsuario };
}

// Iniciar sesión
async function iniciarSesion(email, password) {
    // Validación local para admin
    if (email === 'admin@estudiapp.com' && password === 'admin123') {
        localStorage.setItem('usuarioActual', 'admin');
        return { exito: true, usuario: { nombre: 'Administrador', email, rol: 'admin' } };
    }
    // Si no es admin, busca en Firebase
    const usuario = await buscarUsuarioPorEmail(email);
    if (!usuario || usuario.password !== password) {
        return { exito: false, mensaje: 'Correo electrónico o contraseña incorrectos' };
    }
    localStorage.setItem('usuarioActual', JSON.stringify(usuario));
    return { exito: true, usuario };
}

// Cerrar sesión
function cerrarSesion() {
    localStorage.removeItem('usuarioActual');
    window.location.href = 'login.html';
}

// --- DOMContentLoaded principal ---
document.addEventListener('DOMContentLoaded', async function() {
    await inicializarUsuarios();
    // Obtener solo el id si existe usuarioActual
    let usuarioActualId = null;
    const usuarioActualRaw = localStorage.getItem('usuarioActual');
    if (usuarioActualRaw) {
        if (usuarioActualRaw === 'admin') {
            usuarioActualId = 'admin';
        } else {
            try {
                const usuarioActualObj = JSON.parse(usuarioActualRaw);
                usuarioActualId = usuarioActualObj.id;
            } catch (e) {
                usuarioActualId = usuarioActualRaw;
            }
        }
    }
    await verificarAutenticacion();
    let usuarioActual = null;
    if (usuarioActualId && usuarioActualId !== 'admin') usuarioActual = await obtenerUsuarioPorId(usuarioActualId);
    if (usuarioActual) actualizarInterfazUsuario(usuarioActual);
    // Registro
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const nombre = document.getElementById('nombre').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            if (password !== confirmPassword) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Las contraseñas no coinciden', confirmButtonColor: '#a67c52' });
                return;
            }
            const resultado = await registrarUsuario(nombre, email, password);
            if (resultado.exito) {
                localStorage.setItem('usuarioActual', JSON.stringify(resultado.usuario));
                Swal.fire({ icon: 'success', title: '¡Registro exitoso!', text: 'Bienvenido a EstudiApp', confirmButtonColor: '#a67c52' }).then(() => {
                    window.location.href = 'index.html';
                });
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: resultado.mensaje, confirmButtonColor: '#a67c52' });
            }
        });
    }
    // Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const resultado = await iniciarSesion(email, password);
            if (resultado.exito) {
                localStorage.setItem('usuarioActual', JSON.stringify(resultado.usuario));
                Swal.fire({ icon: 'success', title: '¡Bienvenido!', text: `Hola de nuevo, ${resultado.usuario.nombre}`, confirmButtonColor: '#a67c52' }).then(() => {
                    if (resultado.usuario.rol === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        localStorage.setItem('recargar', '1');
                        window.location.href = 'index.html';
                    }
                });
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: resultado.mensaje, confirmButtonColor: '#a67c52' });
            }
        });
    }
    // Cerrar sesión
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            Swal.fire({ title: '¿Cerrar sesión?', text: '¿Estás seguro de que quieres salir?', icon: 'question', showCancelButton: true, confirmButtonColor: '#a67c52', cancelButtonColor: '#d33', confirmButtonText: 'Sí, cerrar sesión', cancelButtonText: 'Cancelar' }).then((result) => {
                if (result.isConfirmed) cerrarSesion();
            });
        });
    }
    // Editar perfil
    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', async function() {
            const usuarioActualId = localStorage.getItem('usuarioActual');
            const usuarioActual = await obtenerUsuarioPorId(usuarioActualId);
            document.getElementById('edit-nombre').value = usuarioActual.nombre;
            document.getElementById('edit-email').value = usuarioActual.email;
            const profilePreview = document.getElementById('profile-preview');
            if (usuarioActual.fotoPerfil) {
                profilePreview.src = usuarioActual.fotoPerfil;
            } else {
                profilePreview.src = 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png';
            }
            const editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal'));
            editProfileModal.show();
        });
    }
    // Guardar perfil
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async function() {
            const usuarioActualId = localStorage.getItem('usuarioActual');
            const usuarioActual = await obtenerUsuarioPorId(usuarioActualId);
            const nuevoNombre = document.getElementById('edit-nombre').value;
            const nuevoEmail = document.getElementById('edit-email').value;
            const nuevaFoto = document.getElementById('profile-preview').src;
            usuarioActual.nombre = nuevoNombre;
            usuarioActual.email = nuevoEmail;
            usuarioActual.fotoPerfil = nuevaFoto;
            await actualizarUsuario(usuarioActual);
            actualizarInterfazUsuario(usuarioActual);
            const editProfileModal = bootstrap.Modal.getInstance(document.getElementById('editProfileModal'));
            editProfileModal.hide();
            Swal.fire({ icon: 'success', title: 'Perfil actualizado', confirmButtonColor: '#a67c52' });
        });
    }
    // Cambiar contraseña
    const changePasswordBtn = document.getElementById('change-password-btn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-new-password').value = '';
            const changePasswordModal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
            changePasswordModal.show();
        });
    }
    const savePasswordBtn = document.getElementById('save-password-btn');
    if (savePasswordBtn) {
        savePasswordBtn.addEventListener('click', async function() {
            const usuarioActualId = localStorage.getItem('usuarioActual');
            const usuarioActual = await obtenerUsuarioPorId(usuarioActualId);
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmNewPassword = document.getElementById('confirm-new-password').value;
            if (currentPassword !== usuarioActual.password) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'La contraseña actual es incorrecta', confirmButtonColor: '#a67c52' });
                return;
            }
            if (newPassword !== confirmNewPassword) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Las nuevas contraseñas no coinciden', confirmButtonColor: '#a67c52' });
                return;
            }
            usuarioActual.password = newPassword;
            await actualizarUsuario(usuarioActual);
            const changePasswordModal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
            changePasswordModal.hide();
            Swal.fire({ icon: 'success', title: 'Contraseña actualizada', confirmButtonColor: '#a67c52' });
        });
    }
    // Alternancia de visibilidad de contraseña (igual que antes)
    function setupPasswordToggle(passwordInputId, toggleIconId) {
        const passwordInput = document.getElementById(passwordInputId);
        const toggleIcon = document.getElementById(toggleIconId);
        if (passwordInput && toggleIcon) {
            toggleIcon.addEventListener('click', function() {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                this.querySelector('i').classList.toggle('fa-eye');
                this.querySelector('i').classList.toggle('fa-eye-slash');
            });
        }
    }
    setupPasswordToggle('password', 'togglePassword');
    setupPasswordToggle('reg-password', 'toggleRegPassword');
    setupPasswordToggle('confirm-password', 'toggleConfirmPassword');
    setupPasswordToggle('current-password', 'toggleCurrentPassword');
    setupPasswordToggle('new-password', 'toggleNewPassword');
    setupPasswordToggle('confirm-new-password', 'toggleConfirmNewPassword');
});
