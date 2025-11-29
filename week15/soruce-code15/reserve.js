import { 
    loadPlans, getIdDeclared, postDeclare, putDeclare, deleteDeclared,
    getReservationPeriods, getCourseOfferings, getStudentReservations, createReservation, removeReservation
} from "./reserveManagement.js";
import { initKeycloak, signOut } from "./myLib/keycloak.js";

let studentName = ""
let studentId = ""
let plans = []
let planId = ""

let isPeriodActive = false;
let cumulativeCreditLimit = 0;
let currentPeriodData = null;

document.addEventListener("DOMContentLoaded", async () => {
    await login()
    plans = await loadPlans()
    const dropdownPlan = document.getElementById('plan-select')
    plans.forEach(p => dropdownPlan.appendChild(optionEl(p)))

    await initReservationSystem();
    applyPeriodRestrictions();
})

function normalizeStatus(status){
    if (!status) return "";
    if (status === "DECLARED") return "Declared";
    if (status === "CANCELLED") return "Cancelled";
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}



function optionEl(plan) {
    const option = document.createElement('option')
    option.className = "ecors-plan-row"
    option.textContent = `${plan.planCode} - ${plan.nameEng}`
    option.value = plan.id
    return option
}

function handleFormBtn(e){
    const declareBtn = document.querySelector('.ecors-button-declare')
    const changeBtn = document.querySelector('.ecors-button-change')

    if (!isPeriodActive) {
        if(declareBtn) declareBtn.disabled = true;
        if(changeBtn) changeBtn.disabled = true;
        return;
    }

    if(declareBtn){
        if (e.target.value){
            declareBtn.disabled = false
        }else{
            declareBtn.disabled =true
        }
    }
    if(changeBtn){
        if (e.target.value){
            if(e.target.value == planId){
                changeBtn.disabled = true
            }else{
                changeBtn.disabled = false
            }
        }else{
            changeBtn.disabled =true
        }
    }
}

const declareOtp = document.querySelector('.ecors-dropdown-plan')
declareOtp.addEventListener('change', handleFormBtn)


function declaredStatus(declared){
    const declaredPlan = document.querySelector('.ecors-declared-plan')
    const btnDeclare = document.querySelector('.ecors-button-declare')
    const btnForm = document.querySelector('.btnForm')
    const defaultSection = document.querySelector('.ecors-dropdown-plan')
    const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone
    
    if (!declared) {
        declaredPlan.textContent = "Not Declared"
        if (btnForm) btnForm.style.display = 'none'
        

         btnDeclare.style.display = isPeriodActive ? 'block' : 'none';
         btnDeclare.disabled = true
        return
    }
    if (declared.status === "CANCELLED") {
        defaultSection.value = ''
    }
    if(declared.status === "CANCELLED"){
const status = normalizeStatus(declared.status);
declaredPlan.textContent = `${status} ${declared.planCode} - ${declared.nameEng}`;
        btnDeclare.style.display = 'block'
        btnDeclare.disabled = true
        if(btnForm){
            btnForm.remove()
        }
        return
    }

    if (declared.status === "DECLARED" || declared && declared.studentId){
        const status = normalizeStatus(declared.status);
declaredPlan.textContent = `${status} ${declared.planCode} - ${declared.nameEng}`;
        btnDeclare.style.display = 'none'
        if(!btnForm){
            btnElManagement(declared)
            if (declared.status !== "CANCELLED") {
                defaultSection.value = planId
            }else{
                btnForm.style.display = 'flex'
                planId = ''
                defaultSection.value = '';
            }
        }
        
        applyPeriodRestrictions();
    }
}

async function setDeclared(id){ 
    const getDeclared = await getIdDeclared(id)
    if (getDeclared && getDeclared.status !== "CANCELLED") {
        planId = Number(getDeclared.planId) || ''
    }else{
        planId = ''
    }

    if (isPeriodActive) {
        await loadReservationData();
    }

    if (!getDeclared) {
        planId = ''
        console.warn(`No declared plan found for student ${id}`);
        declaredStatus(null)
        applyPeriodRestrictions();
        return
    }

    const localTime = new Date(getDeclared.updatedAt).toLocaleString("en-GB", {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })

    const planFilter = plans.filter( p => p.id === Number(getDeclared.planId))

    if(planFilter.length > 0) {
        getDeclared.planCode = planFilter[0].planCode
        getDeclared.nameEng = planFilter[0].nameEng
    }
    getDeclared.updatedAt = localTime

    declaredStatus(getDeclared)
}

const declareForm = document.querySelector('.declare-form')
declareForm.addEventListener('submit', handleForm)

const okDialog = document.querySelector('.ecors-button-dialog')
const ecorsDialog = document.querySelector('.ecors-dialog')
okDialog.addEventListener('click', () => {
    ecorsDialog.close()
    if (ecorsDialog.dataset.reload === "true") {
        window.location.reload();
    }
})


function btnElManagement(declared) {

    const form = document.querySelector('.declare-form')
    if(document.querySelector('.btnForm')) return; 

    const btnForm = document.createElement('div')
    btnForm.className = 'btnForm'

    const btnChange = document.createElement('button')
    btnChange.className = 'ecors-button-change'
    btnChange.textContent = 'Change'
    btnChange.type = "button";
    btnChange.addEventListener('click', handleChange)
    btnChange.disabled = true

    const btnCancel = document.createElement('button')
    btnCancel.className = 'ecors-button-cancel'
    btnCancel.textContent = 'Cancel Declaration'
    btnCancel.type = "button";
    btnCancel.addEventListener('click', () => handleCancel(declared))

    btnForm.appendChild(btnChange)
    btnForm.appendChild(btnCancel)
    form.appendChild(btnForm)
}

function handleChange(e){
    e.preventDefault()
    const test = new FormData(declareForm)
    const selectValue = test.get("plan-id")
    changeDeclared({planId: Number(selectValue)})
}

async function changeDeclared(planId){
    const dialog = document.querySelector('.ecors-dialog')
    const message = document.querySelector('.ecors-dialog-message')
    dialog.dataset.reload = "false";

    try {
        const data = await putDeclare(studentId, planId)
        const changeBtn = document.querySelector('.ecors-button-change')
        if(changeBtn) changeBtn.disabled = true
        if(data){
            message.textContent = 'Declaration updated.'
            dialog.showModal()
            await setDeclared(studentId)
        }
        await setDeclared(studentId)
    } catch (error) {
        message.textContent = error.message;
        if (error.status === 403) dialog.dataset.reload = "true";
        dialog.showModal();
    }
}

function handleCancel(declared) {
    const dialog = document.querySelector('.ecors-dialog')
    const btnOk = document.querySelector('.ecors-button-dialog')
    const message = document.querySelector('.ecors-dialog-message')
    
    dialog.querySelectorAll('.ecors-button-cancel, .ecors-button-keep, .ecors-button-remove-confirm, .ecors-button-cancel-res').forEach(btn => btn.remove())
    
    message.textContent = ''
    dialog.dataset.reload = "false";

    const btnCancel = document.createElement('button')
    btnCancel.className = 'ecors-button-cancel'
    btnCancel.textContent = 'Cancel Declaration'
    btnCancel.addEventListener('click', () => {
        dialog.close()
        if (btnCancel) btnCancel.remove()
        if (btnKeep) btnKeep.remove()
        message.textContent = ''
        btnOk.style.display = 'block'
        cancelDeclared()
        const btnDeclare = document.querySelector('.ecors-button-declare')
        if(btnDeclare) btnDeclare.disabled = false
    })

    const btnKeep = document.createElement('button')
    btnKeep.className = 'ecors-button-keep'
    btnKeep.textContent = 'Keep Declaration'
    btnKeep.addEventListener('click', () => {
        dialog.close()
        if (btnCancel) btnCancel.remove()
        if (btnKeep) btnKeep.remove()
        message.textContent = ''
        btnOk.style.display = 'block'
    })

    const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone
    message.textContent = `You have declared ${declared.planCode} - ${declared.nameEng} as your plan on ${declared.updatedAt} (${localTZ}). Are you sure you want to cancel this declaration?`
    btnOk.style.display = 'none'

    dialog.appendChild(btnCancel)
    dialog.appendChild(btnKeep)
    dialog.showModal()
}

async function cancelDeclared(){
    const dialog = document.querySelector('.ecors-dialog') 
    const message = document.querySelector('.ecors-dialog-message') 
    const btnOk = document.querySelector('.ecors-button-dialog') 
    dialog.dataset.reload = "false";

    try {
        const data = await deleteDeclared(studentId)
        const dropdown = document.querySelector('.ecors-dropdown-plan')
        const btnDeclare = document.querySelector('.ecors-button-declare')
        const btnChange = document.querySelector(".ecors-button-change")
        const btnCancel = document.querySelector(".ecors-button-cancel")

        planId = ''

        if (data){
            message.textContent = 'Declaration cancelled.'
            btnOk.style.display = 'block'
            dialog.showModal()
            
            await setDeclared(studentId)
        }
        await setDeclared(studentId)
        dropdown.value = '';
        if(btnDeclare) btnDeclare.disabled = true;
        if(btnChange) btnChange.style.display = "none"
        if(btnCancel) btnCancel.style.display = "none"

    } catch (error) {
        if (error.message === 'Declaration cancelled.') {
             message.textContent = 'Declaration cancelled.'
             btnOk.style.display = 'block'
             dialog.showModal()
             await setDeclared(studentId)
             const dropdown = document.querySelector('.ecors-dropdown-plan')
             dropdown.value = '';
        } else {
            message.textContent = error.message
            if (error.status === 403) dialog.dataset.reload = "true";
            btnOk.style.display = 'block'
            dialog.showModal()
            await setDeclared(studentId)
        }
    }
}


async function handleForm(e){
    e.preventDefault()
    const test = new FormData(declareForm)
    const selectValue = test.get("plan-id")
    
    const dialog = document.querySelector('.ecors-dialog')
    const message = document.querySelector('.ecors-dialog-message')
    dialog.dataset.reload = "false";

    try {
        const data = await postDeclare(studentId, {planId: Number(selectValue)})
        if(data){
            await setDeclared(studentId)
        }
        await setDeclared(studentId)
    } catch (error) {
        message.textContent = error.message
        if (error.status === 403) dialog.dataset.reload = "true";
        dialog.showModal()
        await setDeclared(studentId)
    }

}


async function login(){
    const user = await initKeycloak()
    if(user){
        const divName = document.querySelector(".ecors-fullname")
        studentName = user.name
        studentId = user.preferred_username
        divName.textContent += `${studentName}`
        setDeclared(studentId)
        createSignOut()
    }
}

function logout() {
        signOut()
        studentName = ""
        studentId = ""
}

function createSignOut(){
    const profile = document.getElementById("profile")
    if(document.querySelector('.ecors-button-signout')) return; 
    const btnSignOut = document.createElement("button")
    btnSignOut.className = "ecors-button-signout"
    btnSignOut.textContent = "Sign Out"
    btnSignOut.addEventListener("click" , logout)
    profile.append(btnSignOut)
}

async function initReservationSystem() {
    const periodData = await getReservationPeriods();
    const periodSection = document.querySelector('.reservation-period-section');
    const reservationSection = document.getElementById('reservation-section');
    
    if(!periodSection) return;
    periodSection.innerHTML = '';

    if (periodData.currentPeriod) {
        isPeriodActive = true;
        currentPeriodData = periodData.currentPeriod;
        cumulativeCreditLimit = periodData.currentPeriod.cumulativeCreditLimit;

        const openMsg = document.createElement('div');
        openMsg.dataset.cy = "current-message";
        openMsg.style.color = "green";
        openMsg.style.fontWeight = "bold";
        openMsg.textContent = "Reservation is open";
        periodSection.appendChild(openMsg);

        const periodTime = document.createElement('div');
        periodTime.dataset.cy = "current-period";
        periodTime.textContent = `Period: ${formatDate(currentPeriodData.startDateTime)} - ${formatDate(currentPeriodData.endDateTime)}`;
        periodSection.appendChild(periodTime);

        if(reservationSection) reservationSection.style.display = 'block';

    } else {
        isPeriodActive = false;
        
        const closedMsg = document.createElement('div');
        closedMsg.dataset.cy = "current-message";
        closedMsg.style.color = "red";
        closedMsg.style.fontWeight = "bold";
        closedMsg.textContent = "Reservation is closed";
        periodSection.appendChild(closedMsg);

        if(reservationSection) reservationSection.style.display = 'none';
    }

    if (periodData.nextPeriod) {
        const nextMsg = document.createElement('div');
        nextMsg.dataset.cy = "next-message";
        nextMsg.textContent = "Next reservation period:";
        nextMsg.style.marginTop = "10px";
        periodSection.appendChild(nextMsg);

        const nextTime = document.createElement('div');
        nextTime.dataset.cy = "next-period";
        nextTime.textContent = `Period: ${formatDate(periodData.nextPeriod.startDateTime)} - ${formatDate(periodData.nextPeriod.endDateTime)}`;
        periodSection.appendChild(nextTime);
    } else {
        const noNextMsg = document.createElement('div');
        noNextMsg.dataset.cy = "next-message";
        noNextMsg.textContent = "There are no upcoming active reservation periods.";
        noNextMsg.style.marginTop = "10px";
        periodSection.appendChild(noNextMsg);
    }
}

function applyPeriodRestrictions() {
    if (!isPeriodActive) {
        const btns = document.querySelectorAll('.ecors-button-declare, .ecors-button-change, .ecors-button-cancel, .btnForm');
        btns.forEach(btn => {
            btn.style.display = 'none';
        });
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${date.toLocaleString('en-GB', { timeZone: tz })} (${tz})`;
}

async function loadReservationData() {
    if (!isPeriodActive) return;

    const [offeringsData, myResData] = await Promise.all([
        getCourseOfferings(),
        getStudentReservations(studentId)
    ]);

    renderReservations(myResData);
    renderCourseOfferings(offeringsData.courseOfferings, myResData);
}

function renderReservations(data) {
    const listContainer = document.getElementById('your-reservations-list');
    const totalSpan = document.getElementById('total-credits');
    const limitSpan = document.getElementById('credit-limit');

    if(limitSpan) limitSpan.textContent = cumulativeCreditLimit;
    if(totalSpan) totalSpan.textContent = data.reservedCredits;

    if(!listContainer) return;
    listContainer.innerHTML = '';
    
    if (data.reservedCourses.length === 0) {
        listContainer.innerHTML = '<p>No reserved courses yet.</p>';
        return;
    }

    data.reservedCourses.sort((a, b) => a.courseCode.localeCompare(b.courseCode));

    data.reservedCourses.forEach(course => {
        const row = document.createElement('div');
        row.dataset.cy = "course-reserved";
        row.className = 'ecors-reserved-row';
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        row.style.marginBottom = "5px";
        row.style.padding = "10px";
        row.style.border = "1px solid #ccc";

        const info = document.createElement('span');
        info.textContent = `${course.courseCode} ${course.courseTitle} ${course.courseCredits} credits`;
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.className = 'ecors-button-remove';
        removeBtn.style.marginLeft = "10px";
        removeBtn.style.backgroundColor = "#dc3545";
        removeBtn.style.color = "white";
        removeBtn.onclick = () => handleRemoveClick(course);

        row.appendChild(info);
        row.appendChild(removeBtn);
        listContainer.appendChild(row);
    });
}

function renderCourseOfferings(offerings, myReservations) {
    const listContainer = document.getElementById('course-offerings-list');
    if(!listContainer) return;
    listContainer.innerHTML = '';

    offerings.sort((a, b) => a.courseCode.localeCompare(b.courseCode));

    const reservedIds = myReservations.reservedCourses.map(c => c.courseOfferingId);
    const currentCredits = myReservations.reservedCredits;

    offerings.forEach(course => {
        const div = document.createElement('div');
        div.dataset.cy = "course-offering";
        div.className = 'ecors-offering-row';
        div.style.border = "1px solid #ddd";
        div.style.padding = "10px";
        div.style.marginBottom = "10px";
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        
        const isCore = planId && course.planIds && course.planIds.includes(Number(planId));
        if (isCore) {
            div.style.backgroundColor = "#e6f7ff";
            div.style.borderLeft = "5px solid #007bff";
        }

        const infoDiv = document.createElement('div');
        let html = `
            <div data-cy="course-code" style="font-weight:bold;">${course.courseCode}</div>
            <div data-cy="course-title">${course.courseTitle}</div>
            <div data-cy="course-credits">${course.courseCredits} credits</div>
        `;
        if (isCore) {
            html += `<div data-cy="course-core" style="color: blue; font-size: 0.9em;">Core course of your plan</div>`;
        }
        infoDiv.innerHTML = html;

        const btnDiv = document.createElement('div');
        const reserveBtn = document.createElement('button');
        reserveBtn.textContent = 'Reserve';
        reserveBtn.dataset.cy = "button-reserve";
        reserveBtn.className = "ecors-button-reserve";

        const isReserved = reservedIds.includes(course.id);
        const willExceed = (currentCredits + course.courseCredits) > cumulativeCreditLimit;
        
        if (isReserved) {
            reserveBtn.disabled = true;
            reserveBtn.textContent = "Reserved";
        } else if (willExceed) {
            reserveBtn.disabled = true;
            reserveBtn.title = "Credit limit exceeded";
        }

        reserveBtn.onclick = () => handleReserveClick(course.id);

        btnDiv.appendChild(reserveBtn);
        div.appendChild(infoDiv);
        div.appendChild(btnDiv);
        listContainer.appendChild(div);
    });
}

async function handleReserveClick(offeringId) {
    const dialog = document.querySelector('.ecors-dialog');
    const message = document.querySelector('.ecors-dialog-message');
    const btnOk = document.querySelector('.ecors-button-dialog');
    
    dialog.dataset.reload = "false"; 

    try {
        await createReservation(studentId, offeringId);
        await loadReservationData();
    } catch (error) {
        message.textContent = error.message;
        if (error.status === 403) dialog.dataset.reload = "true";
        dialog.querySelectorAll('.ecors-button-remove-confirm, .ecors-button-cancel-res').forEach(btn => btn.remove());
        
        btnOk.style.display = 'block';
        dialog.showModal();
    }
}

function handleRemoveClick(course) {
    const dialog = document.querySelector('.ecors-dialog');
    const message = document.querySelector('.ecors-dialog-message');
    const btnOk = document.querySelector('.ecors-button-dialog');

    // Clean up
    dialog.querySelectorAll('.ecors-button-cancel, .ecors-button-keep, .ecors-button-remove-confirm, .ecors-button-cancel-res').forEach(btn => btn.remove());

    dialog.dataset.reload = "false";
    message.textContent = `Are you sure you want to remove ${course.courseCode} ${course.courseTitle}?`;
    btnOk.style.display = 'none';

    const btnRemove = document.createElement('button');
    btnRemove.className = 'ecors-button-remove-confirm';
    btnRemove.textContent = 'Remove';
    btnRemove.style.backgroundColor = "#dc3545"; // Red
    btnRemove.style.color = "white";
    
    const btnCancel = document.createElement('button');
    btnCancel.className = 'ecors-button-cancel-res';
    btnCancel.textContent = 'Cancel';

    btnCancel.onclick = () => {
        dialog.close();
        btnRemove.remove();
        btnCancel.remove();
        btnOk.style.display = 'block';
    };

    btnRemove.onclick = async () => {
        dialog.close();
        btnRemove.remove();
        btnCancel.remove();
        btnOk.style.display = 'block';

        try {
            await removeReservation(studentId, course.courseOfferingId);
            await loadReservationData(); 
        } catch (error) {
            message.textContent = error.message;
            if (error.status === 403) dialog.dataset.reload = "true";
            dialog.showModal();
        }
    };

    if(document.querySelector('.dialog-buttons')){
         document.querySelector('.dialog-buttons').appendChild(btnRemove);
         document.querySelector('.dialog-buttons').appendChild(btnCancel);
    } else {
         dialog.appendChild(btnRemove);
         dialog.appendChild(btnCancel);
    }
   
    dialog.showModal();
}


