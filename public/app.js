// Configuration
const API_URL = 'http://localhost:3000/api';
let token = null;
let socket = null;
let currentUser = null;
let sessionCheckInterval = null;
let currentGroupId = null;

// ========== INITIALISATION ==========

document.addEventListener('DOMContentLoaded', () => {
    token = localStorage.getItem('token');
    
    if (token) {
        verifyToken();
    }
    
    // Gestionnaires d'événements
    setupEventListeners();
});

function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    const userForm = document.getElementById('userForm');
    const groupForm = document.getElementById('groupForm');
    const addMemberForm = document.getElementById('addMemberForm');
    const badgeForm = document.getElementById('badgeForm');
    const doorForm = document.getElementById('doorForm');
    const accessForm = document.getElementById('accessForm');
    
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (userForm) userForm.addEventListener('submit', handleUserSubmit);
    if (groupForm) groupForm.addEventListener('submit', handleGroupSubmit);
    if (addMemberForm) addMemberForm.addEventListener('submit', handleAddMemberSubmit);
    if (badgeForm) badgeForm.addEventListener('submit', handleBadgeSubmit);
    if (doorForm) doorForm.addEventListener('submit', handleDoorSubmit);
    if (accessForm) accessForm.addEventListener('submit', handleAccessSubmit);
}

// ========== AUTHENTIFICATION ==========

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            showDashboard();
            initializeWebSocket();
            loadAllData();
            startSessionMonitoring();
        } else {
            showAlert('loginAlert', data.error || 'Erreur de connexion', 'error');
        }
    } catch (error) {
        showAlert('loginAlert', 'Erreur de connexion au serveur', 'error');
    }
}

async function verifyToken() {
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showDashboard();
            initializeWebSocket();
            loadAllData();
            startSessionMonitoring();
        } else {
            logout();
        }
    } catch (error) {
        logout();
    }
}

function logout() {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    
    if (socket) {
        socket.disconnect();
    }
    
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
    
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('loginPage').style.display = 'block';
}

function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('userName').textContent = `${currentUser.prenom} ${currentUser.nom}`;
}

// ========== MONITORING DE SESSION ==========

function startSessionMonitoring() {
    // Vérifier l'état de la session toutes les 30 secondes
    sessionCheckInterval = setInterval(checkSessionStatus, 30000);
    checkSessionStatus();
}

async function checkSessionStatus() {
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (data.code === 'TIMEOUT' || data.code === 'ADMIN_TIMEOUT') {
                showNotification('Session expirée par inactivité', 'error');
                logout();
            } else if (data.code === 'SESSION_EXPIRED') {
                showNotification('Session expirée', 'error');
                logout();
            }
        } else if (data.session) {
            updateSessionDisplay(data.session);
        }
    } catch (error) {
        console.error('Erreur vérification session:', error);
    }
}

function updateSessionDisplay(session) {
    const display = document.getElementById('timeoutDisplay');
    const container = document.getElementById('sessionTimeout');
    
    if (session.minutes_inactive >= session.timeout_minutes - 5) {
        container.classList.add('timeout-warning');
        display.textContent = `⚠️ Inactivité: ${session.minutes_inactive}/${session.timeout_minutes} min`;
    } else {
        container.classList.remove('timeout-warning');
        display.textContent = `Session active (${session.minutes_inactive} min)`;
    }
}

// ========== WEBSOCKET ==========

function initializeWebSocket() {
    socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
        console.log('WebSocket connecté');
        socket.emit('authenticate', token);
    });
    
    socket.on('authenticated', (data) => {
        if (data.success) {
            console.log('WebSocket authentifié');
        }
    });
    
    socket.on('access_attempt', (data) => {
        addRealtimeLog(data);
        loadStats();
    });
    
    socket.on('security_alert', (data) => {
        showNotification('Alerte de sécurité: ' + data.type, 'error');
        loadAlerts();
    });
    
    socket.on('door_offline', (data) => {
        showNotification(`Porte hors ligne: ${data.door_name}`, 'error');
        loadDoors();
    });
    
    socket.on('door_online', (data) => {
        showNotification(`Porte reconnectée: ${data.door_name}`, 'success');
        loadDoors();
    });
    
    socket.on('group_created', () => loadGroups());
    socket.on('badge_created', () => loadBadges());
}

// ========== NAVIGATION ==========

function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    switch(tabName) {
        case 'stats': loadStats(); break;
        case 'doors': loadDoors(); break;
        case 'users': loadUsers(); break;
        case 'groups': loadGroups(); break;
        case 'badges': loadBadges(); break;
        case 'access': loadAccessRights(); break;
        case 'logs': loadLogs(); break;
        case 'alerts': loadAlerts(); break;
    }
}

// ========== MODAL ==========

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    
    if (modalId === 'badgeModal') {
        loadUsersForSelect('badgeUserId');
    } else if (modalId === 'accessModal') {
        loadBadgesForSelect('accessBadgeId');
        loadGroupsForSelect('accessGroupId');
        loadDoorsForSelect('accessDoorId');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    const formId = modalId.replace('Modal', 'Form');
    const form = document.getElementById(formId);
    if (form) form.reset();
}

// ========== CHARGEMENT DES DONNÉES ==========

function loadAllData() {
    loadStats();
    loadDoors();
    loadUsers();
    loadGroups();
    loadBadges();
    loadAccessRights();
    loadLogs();
    loadAlerts();
}

async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/logs/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('totalAccess').textContent = data.stats.total || 0;
            document.getElementById('authorizedAccess').textContent = data.stats.authorized || 0;
            document.getElementById('deniedAccess').textContent = data.stats.denied || 0;
        }
        
        const badgesResponse = await fetch(`${API_URL}/badges?is_active=true`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (badgesResponse.ok) {
            const badgesData = await badgesResponse.json();
            document.getElementById('activeBadges').textContent = badgesData.badges.length;
        }
    } catch (error) {
        console.error('Erreur loadStats:', error);
    }
}

async function loadDoors() {
    try {
        const response = await fetch(`${API_URL}/doors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const tbody = document.querySelector('#doorsTable tbody');
            tbody.innerHTML = '';
            
            data.doors.forEach(door => {
                const row = `
                    <tr>
                        <td>${door.id}</td>
                        <td>${door.nom}</td>
                        <td>${door.localisation || '-'}</td>
                        <td><code>${door.esp32_id}</code></td>
                        <td>${door.esp32_ip || '-'}</td>
                        <td><span class="badge ${door.is_online ? 'badge-success' : 'badge-danger'}">${door.is_online ? '🟢 En ligne' : '🔴 Hors ligne'}</span></td>
                        <td><span class="badge ${door.is_active ? 'badge-success' : 'badge-danger'}">${door.is_active ? 'Actif' : 'Inactif'}</span></td>
                        <td>
                            <button class="btn-danger" onclick="deleteDoor(${door.id})">Supprimer</button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        console.error('Erreur loadDoors:', error);
    }
}

async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const tbody = document.querySelector('#usersTable tbody');
            tbody.innerHTML = '';
            
            data.users.forEach(user => {
                const row = `
                    <tr>
                        <td>${user.id}</td>
                        <td>${user.prenom} ${user.nom}</td>
                        <td>${user.email}</td>
                        <td>${user.telephone || '-'}</td>
                        <td><span class="badge ${user.role === 'admin' ? 'badge-warning' : 'badge-info'}">${user.role}</span></td>
                        <td><span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">${user.is_active ? 'Actif' : 'Inactif'}</span></td>
                        <td>
                            <button class="btn-danger" onclick="deleteUser(${user.id})">Supprimer</button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        console.error('Erreur loadUsers:', error);
    }
}

async function loadGroups() {
    try {
        const response = await fetch(`${API_URL}/groups`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const tbody = document.querySelector('#groupsTable tbody');
            tbody.innerHTML = '';
            
            data.groups.forEach(group => {
                const row = `
                    <tr>
                        <td>${group.id}</td>
                        <td>
                            <span class="group-color-preview" style="background: ${group.couleur}"></span>
                            ${group.nom}
                        </td>
                        <td>${group.description || '-'}</td>
                        <td><span class="member-count">${group.member_count || 0} membres</span></td>
                        <td><span class="badge badge-info">${group.access_rights_count || 0} droits</span></td>
                        <td><span class="badge ${group.is_active ? 'badge-success' : 'badge-danger'}">${group.is_active ? 'Actif' : 'Inactif'}</span></td>
                        <td>
                            <div class="btn-group">
                                <button class="btn-success" onclick="viewGroupMembers(${group.id}, '${group.nom}')">👥 Membres</button>
                                <button class="btn-danger" onclick="deleteGroup(${group.id})">Supprimer</button>
                            </div>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        console.error('Erreur loadGroups:', error);
    }
}

async function viewGroupMembers(groupId, groupName) {
    currentGroupId = groupId;
    document.getElementById('groupMemberTitle').textContent = groupName;
    
    try {
        const response = await fetch(`${API_URL}/groups/${groupId}/members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const tbody = document.querySelector('#groupMembersTable tbody');
            tbody.innerHTML = '';
            
            if (data.members.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Aucun membre</td></tr>';
            } else {
                data.members.forEach(member => {
                    const row = `
                        <tr>
                            <td>${member.prenom} ${member.nom}</td>
                            <td>${member.email}</td>
                            <td>${new Date(member.added_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn-danger" onclick="removeMember(${groupId}, ${member.id})">Retirer</button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            }
        }
        
        openModal('groupMembersModal');
    } catch (error) {
        console.error('Erreur viewGroupMembers:', error);
    }
}

function openAddMemberModal() {
    loadUsersForSelect('memberUserId');
    openModal('addMemberModal');
}

async function loadBadges() {
    try {
        const response = await fetch(`${API_URL}/badges`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const tbody = document.querySelector('#badgesTable tbody');
            tbody.innerHTML = '';
            
            data.badges.forEach(badge => {
                const row = `
                    <tr>
                        <td>${badge.id}</td>
                        <td><code>${badge.badge_uid}</code></td>
                        <td>${badge.user_name}</td>
                        <td><span class="badge ${badge.is_active ? 'badge-success' : 'badge-danger'}">${badge.is_active ? 'Actif' : 'Inactif'}</span></td>
                        <td>${badge.date_expiration ? new Date(badge.date_expiration).toLocaleDateString() : 'Aucune'}</td>
                        <td>
                            <button class="btn-danger" onclick="deleteBadge(${badge.id})">Supprimer</button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        console.error('Erreur loadBadges:', error);
    }
}

async function loadAccessRights() {
    try {
        const response = await fetch(`${API_URL}/access`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const tbody = document.querySelector('#accessTable tbody');
            tbody.innerHTML = '';
            
            if (!data.accessRights || data.accessRights.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Aucun droit d\'accès</td></tr>';
                return;
            }
            
            data.accessRights.forEach(access => {
                const jours = access.jours_semaine.split(',').map(j => {
                    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
                    return days[parseInt(j) - 1];
                }).join(', ');
                
                const type = access.access_type === 'group' ? 'Groupe' : 'Badge';
                const name = access.access_type === 'group' ? access.group_name : access.user_name;
                const typeBadge = access.access_type === 'group' ? 'badge-info' : 'badge-success';
                
                const row = `
                    <tr>
                        <td><span class="badge ${typeBadge}">${type}</span></td>
                        <td>${name}</td>
                        <td>${access.door_name}</td>
                        <td>${access.heure_debut} - ${access.heure_fin}</td>
                        <td>${jours}</td>
                        <td><span class="badge ${access.is_active ? 'badge-success' : 'badge-danger'}">${access.is_active ? 'Actif' : 'Inactif'}</span></td>
                        <td>
                            <button class="btn-danger" onclick="deleteAccessRight(${access.id})">Supprimer</button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        console.error('Erreur loadAccessRights:', error);
    }
}

async function loadLogs() {
    try {
        const response = await fetch(`${API_URL}/logs?limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const tbody = document.querySelector('#logsTable tbody');
            tbody.innerHTML = '';
            
            data.logs.forEach(log => {
                const row = `
                    <tr>
                        <td>${new Date(log.access_datetime).toLocaleString()}</td>
                        <td>${log.user_name || 'Inconnu'}</td>
                        <td><code>${log.badge_uid}</code></td>
                        <td>${log.door_name}</td>
                        <td><span class="badge ${log.access_granted ? 'badge-success' : 'badge-danger'}">${log.access_granted ? 'Autorisé' : 'Refusé'}</span></td>
                        <td>${log.reason}</td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        console.error('Erreur loadLogs:', error);
    }
}

async function loadAlerts() {
    try {
        const response = await fetch(`${API_URL}/alerts?is_read=false`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const container = document.getElementById('alertsList');
            container.innerHTML = '';
            
            if (data.alerts.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><h3>Aucune alerte</h3><p>Tout est en ordre</p></div>';
                return;
            }
            
            data.alerts.forEach(alert => {
                const alertDiv = `
                    <div class="log-entry danger">
                        <div class="log-time">${new Date(alert.created_at).toLocaleString()}</div>
                        <div class="log-info">
                            <strong>${alert.type}</strong> - ${alert.message}
                            ${alert.door_name ? `<br>Porte: ${alert.door_name}` : ''}
                        </div>
                        <button class="btn-success" onclick="markAlertRead(${alert.id})" style="margin-top: 10px;">Marquer comme lu</button>
                    </div>
                `;
                container.innerHTML += alertDiv;
            });
        }
    } catch (error) {
        console.error('Erreur loadAlerts:', error);
    }
}

// ========== LOGS TEMPS RÉEL ==========

function addRealtimeLog(data) {
    const container = document.getElementById('realtimeLogs');
    const logDiv = document.createElement('div');
    logDiv.className = `log-entry ${data.access_granted ? 'success' : 'danger'}`;
    logDiv.innerHTML = `
        <div class="log-time">${new Date(data.timestamp).toLocaleString()}</div>
        <div class="log-info">
            <strong>${data.user_name || 'Badge inconnu'}</strong> - 
            ${data.access_granted ? 'Accès autorisé' : 'Accès refusé'}
            <br>Badge: <code>${data.badge_uid}</code> | Raison: ${data.reason}
        </div>
    `;
    
    container.insertBefore(logDiv, container.firstChild);
    
    while (container.children.length > 10) {
        container.removeChild(container.lastChild);
    }
}

// ========== SOUMISSION FORMULAIRES ==========

async function handleUserSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeModal('userModal');
            loadUsers();
            showNotification('Utilisateur créé avec succès', 'success');
        } else {
            const error = await response.json();
            alert(error.error || 'Erreur lors de la création');
        }
    } catch (error) {
        alert('Erreur de connexion au serveur');
    }
}

async function handleGroupSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch(`${API_URL}/groups`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeModal('groupModal');
            loadGroups();
            showNotification('Groupe créé avec succès', 'success');
        } else {
            const error = await response.json();
            alert(error.error || 'Erreur lors de la création');
        }
    } catch (error) {
        alert('Erreur de connexion au serveur');
    }
}

async function handleAddMemberSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const user_id = formData.get('user_id');
    
    try {
        const response = await fetch(`${API_URL}/groups/${currentGroupId}/members`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id })
        });
        
        if (response.ok) {
            closeModal('addMemberModal');
            viewGroupMembers(currentGroupId, document.getElementById('groupMemberTitle').textContent);
            loadGroups();
            showNotification('Membre ajouté avec succès', 'success');
        } else {
            const error = await response.json();
            alert(error.error || 'Erreur lors de l\'ajout');
        }
    } catch (error) {
        alert('Erreur de connexion au serveur');
    }
}

async function handleBadgeSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch(`${API_URL}/badges`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const result = await response.json();
            closeModal('badgeModal');
            loadBadges();
            alert(`Badge créé avec succès!\n\nClé de chiffrement: ${result.encryptionKey}\n\n⚠️ Notez cette clé, elle ne sera plus affichée!`);
        } else {
            const error = await response.json();
            alert(error.error || 'Erreur lors de la création');
        }
    } catch (error) {
        alert('Erreur de connexion au serveur');
    }
}

async function handleDoorSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch(`${API_URL}/doors`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeModal('doorModal');
            loadDoors();
            showNotification('Porte créée avec succès', 'success');
        } else {
            const error = await response.json();
            alert(error.error || 'Erreur lors de la création');
        }
    } catch (error) {
        alert('Erreur de connexion au serveur');
    }
}

async function handleAccessSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Récupérer les jours sélectionnés
    const jours = Array.from(document.querySelectorAll('#accessModal input[type="checkbox"]:checked'))
        .map(cb => cb.value)
        .join(',');
    
    data.jours_semaine = jours || '1,2,3,4,5,6,7';
    
    // Convertir les heures au format HH:MM:SS
    if (data.heure_debut) data.heure_debut += ':00';
    if (data.heure_fin) data.heure_fin += ':59';
    
    try {
        const response = await fetch(`${API_URL}/access`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeModal('accessModal');
            loadAccessRights();
            showNotification('Droit d\'accès créé avec succès', 'success');
        } else {
            const error = await response.json();
            alert(error.error || 'Erreur lors de la création');
        }
    } catch (error) {
        alert('Erreur de connexion au serveur');
    }
}

// ========== SUPPRESSION ==========

async function deleteUser(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
    
    try {
        const response = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            loadUsers();
            showNotification('Utilisateur supprimé', 'success');
        }
    } catch (error) {
        alert('Erreur lors de la suppression');
    }
}

async function deleteGroup(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce groupe ?')) return;
    
    try {
        const response = await fetch(`${API_URL}/groups/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            loadGroups();
            showNotification('Groupe supprimé', 'success');
        }
    } catch (error) {
        alert('Erreur lors de la suppression');
    }
}

async function removeMember(groupId, userId) {
    if (!confirm('Retirer ce membre du groupe ?')) return;
    
    try {
        const response = await fetch(`${API_URL}/groups/${groupId}/members/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            viewGroupMembers(groupId, document.getElementById('groupMemberTitle').textContent);
            loadGroups();
            showNotification('Membre retiré', 'success');
        }
    } catch (error) {
        alert('Erreur lors du retrait');
    }
}

async function deleteBadge(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce badge ?')) return;
    
    try {
        const response = await fetch(`${API_URL}/badges/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            loadBadges();
            showNotification('Badge supprimé', 'success');
        }
    } catch (error) {
        alert('Erreur lors de la suppression');
    }
}

async function deleteDoor(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette porte ?')) return;
    
    try {
        const response = await fetch(`${API_URL}/doors/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            loadDoors();
            showNotification('Porte supprimée', 'success');
        }
    } catch (error) {
        alert('Erreur lors de la suppression');
    }
}

async function deleteAccessRight(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce droit d\'accès ?')) return;
    
    try {
        const response = await fetch(`${API_URL}/access/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            loadAccessRights();
            showNotification('Droit d\'accès supprimé', 'success');
        }
    } catch (error) {
        alert('Erreur lors de la suppression');
    }
}

// ========== ALERTES ==========

async function markAlertRead(id) {
    try {
        await fetch(`${API_URL}/alerts/${id}/read`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadAlerts();
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function markAllAlertsRead() {
    try {
        await fetch(`${API_URL}/alerts/read-all`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadAlerts();
        showNotification('Toutes les alertes ont été marquées comme lues', 'success');
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// ========== UTILITAIRES ==========

async function loadUsersForSelect(selectId) {
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Sélectionner un utilisateur</option>';
            
            data.users.forEach(user => {
                select.innerHTML += `<option value="${user.id}">${user.prenom} ${user.nom} (${user.email})</option>`;
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function loadBadgesForSelect(selectId) {
    try {
        const response = await fetch(`${API_URL}/badges`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Sélectionner un badge</option>';
            
            data.badges.forEach(badge => {
                select.innerHTML += `<option value="${badge.id}">${badge.user_name} (${badge.badge_uid})</option>`;
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function loadGroupsForSelect(selectId) {
    try {
        const response = await fetch(`${API_URL}/groups`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Sélectionner un groupe</option>';
            
            data.groups.forEach(group => {
                select.innerHTML += `<option value="${group.id}">${group.nom} (${group.member_count} membres)</option>`;
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function loadDoorsForSelect(selectId) {
    try {
        const response = await fetch(`${API_URL}/doors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Sélectionner une porte</option>';
            
            data.doors.forEach(door => {
                select.innerHTML += `<option value="${door.id}">${door.nom} - ${door.localisation || door.esp32_id}</option>`;
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

function showAlert(elementId, message, type) {
    const alert = document.getElementById(elementId);
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.display = 'block';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #4caf50, #45a049)' : 'linear-gradient(135deg, #f44336, #d32f2f)'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: 600;
        max-width: 400px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========== ANIMATIONS CSS ==========
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);