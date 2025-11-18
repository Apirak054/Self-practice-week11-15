const isLocal_reserve = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_HOST_reserve = isLocal_reserve ? 'http://localhost:3000' : '';
const apiBaseUrl = `${API_HOST_reserve}/intproj25/pl1/itb-ecors/api/v1`;

const declaredPlanEl = document.getElementById("ecors-declared-plan");
const declareSectionEl = document.getElementById("declare-section");
const dropdown = document.getElementById("ecors-dropdown-plan");
const declareBtn = document.getElementById("ecors-button-declare");
const fullNameEl = document.getElementById("ecors-fullname");
const signOutBtn = document.getElementById("ecors-button-signout");

let studentId = null;
let authToken = null;

// --- Keycloak Init ---
const keycloakConfig = {
  url: "https://bscit.sit.kmutt.ac.th/intproj25/ft/keycloak/",
  realm: "itb-ecors",
  clientId: "itb-ecors-pl1"
};

const keycloak = new Keycloak(keycloakConfig);

if (declaredPlanEl) {
  keycloak.init({ onLoad: 'login-required', checkLoginIframe: false })
    .then(authenticated => {
      if (authenticated) {
        setupUser(keycloak);
        fetchDeclarationStatus();
      }
    })
    .catch(() => {
      console.error('Keycloak initialization failed');
      declaredPlanEl.textContent = "Authentication failed.";
    });
}

// user
function setupUser(kc) {
  console.log(kc);
  studentId = kc.tokenParsed.preferred_username;
  authToken = kc.token;
  fullNameEl.textContent = `${kc.tokenParsed.name}`;


  signOutBtn.addEventListener('click', () => {
   studentId = null;
    authToken = null;
    fullNameEl.textContent = '';

     if (declareSectionEl) declareSectionEl.style.display = 'none';
    if (declaredPlanEl) declaredPlanEl.textContent = 'You have been logged out.';

    // const logoutUrl = new URL(kc.endpoints.logout());
    // logoutUrl.searchParams.append('post_logout_redirect_uri', `${window.location.origin}/intproj25/pl1/itb-ecors/`);
    // 3. Add the client_id
    // logoutUrl.searchParams.append('client_id', kc.clientId);
    // window.location.href = logoutUrl.href;
  });

  dropdown.addEventListener("change", () => {
    declareBtn.disabled = dropdown.value === "";
  });

  declareBtn.addEventListener('click', handleDeclare);
}
async function fetchDeclarationStatus() {
  if (!studentId) return;

  declaredPlanEl.textContent = "Loading status...";

  try {
    const res = await fetch(`${apiBaseUrl}/students/${studentId}/declared-plan`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.status === 200) { 
      const data = await res.json();
      renderDeclared(data);
    } else if (res.status === 404) { 
      renderNotDeclared();
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(err);
    showDialog_reserve("Could not load declaration status. Please refresh.");
  }
}

// ======================= RENDER STATUS =======================
function renderDeclared(data) {
  const date = new Date(data.updatedAt); 
  const formattedDate = date.toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short'
  }).replace(',', '');

  declaredPlanEl.textContent =
    `Declaration Status: Declared ${data.planCode} - ${data.planNameEng} plan on ${formattedDate}`;

  if (declareSectionEl) declareSectionEl.style.display = 'none';
}

function renderNotDeclared() {
  declaredPlanEl.textContent = "Declaration Status: Not Declared";
  if (declareSectionEl) declareSectionEl.style.display = 'block';
  loadStudyPlansForDropdown();
}

// ======================= DECLARE LOGIC =======================
async function loadStudyPlansForDropdown() {
  try {
    const response = await fetch(`${apiBaseUrl}/study-plans`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!response.ok) throw new Error("Failed to fetch study plans");

    const plans = await response.json();
    dropdown.innerHTML = '<option value="">-- Select Major --</option>';

    plans.forEach(plan => {
      const option = document.createElement("option");
      option.value = plan.id;
      // Assuming API returns 'planCode' and 'nameEng'
      option.textContent = `${plan.planCode} - ${plan.nameEng}`;
      dropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading study plans:", error);
    showDialog_reserve("Cannot load study plans. Please try again later.");
  }
}

async function handleDeclare() {
  const selectedPlanId = dropdown.value;
  if (!selectedPlanId) return;

  declareBtn.disabled = true;

  try {
    const res = await fetch(`${apiBaseUrl}/students/${studentId}/declared-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ planId: parseInt(selectedPlanId) })
    });

    if (res.status === 201) {
      const data = await res.json();
      renderDeclared(data);
    } else if (res.status === 409) {
      showDialog_reserve("You may have declared study plan already. Please check again.", "conflict");
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(err);
    showDialog_reserve("There is a problem. Please try again later.");
    declareBtn.disabled = false;
  }
}

// ======================= DIALOG (reserve.html) =======================
function showDialog_reserve(message, type = 'error') {
  document.querySelectorAll('dialog.ecors-dialog').forEach(d => d.remove());

  const dialog = document.createElement('dialog');
  dialog.classList.add('ecors-dialog');
  dialog.innerHTML = `
    <div id="ecors-dialog-message" class="ecors-dialog-message">${message}</div>
    <button id="ecors-button-dialog">Ok</button>
  `;
  dialog.addEventListener('cancel', e => e.preventDefault());
  const okButton = dialog.querySelector('#ecors-button-dialog');

  const closeHandler = () => {
    dialog.close();
    document.body.removeChild(dialog);
    // (TC-PBI4-3) If 409, refresh status after closing dialog
    if (type === 'conflict' && !document.querySelector('#ecors-dialog-message:contains("Could not load")')) {
      fetchDeclarationStatus();
    }
  };

  okButton.addEventListener('click', closeHandler);

  dialog.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeHandler();
    }
  });

  document.body.appendChild(dialog);
  dialog.showModal();
}