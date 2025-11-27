/**
 * Project Requirements Form - Main Logic (Updated with Top Banner)
 */

const CONFIG = {
    jsonPath: 'client_requirements_questions.json',
    storageKey: 'project_requirements_v1',
    // TODO: INSERT WEB3FORM KEY HERE
    web3FormKey: '368d607e-fe1e-402e-8687-79e76c8f5ece',
    web3FormUrl: 'https://api.web3forms.com/submit'
};

// State Management
const state = {
    sections: [],
    currentSectionIndex: 0,
    answers: {},
    isSubmitting: false
};

// DOM Elements
const elements = {
    form: document.getElementById('requirements-form'),
    sectionContent: document.getElementById('section-content'),
    sectionIndicator: document.getElementById('section-indicator'),
    sectionTitle: document.getElementById('section-title'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    btnBack: document.getElementById('btn-back'),
    btnNext: document.getElementById('btn-next'),
    btnSave: document.getElementById('btn-save'),
    // Updated Explanation Banner Elements
    explanationBanner: document.getElementById('explanation-banner'),
    explanationText: document.getElementById('explanation-text'),
    closeExplanationBtn: document.getElementById('close-explanation'),

    toast: document.getElementById('toast'),
    bgCanvas: document.getElementById('bg-canvas')
};

// --- Initialization ---

async function init() {
    try {
        await loadData();
        loadProgress();
        renderSection();
        initBackground();
        setupEventListeners();
    } catch (error) {
        showToast('Failed to load form data. Please refresh.', 'error');
        console.error(error);
    }
}

async function loadData() {
    const response = await fetch(CONFIG.jsonPath);
    if (!response.ok) throw new Error('Failed to load JSON');
    const data = await response.json();
    state.sections = data.sections;
}

function loadProgress() {
    const saved = localStorage.getItem(CONFIG.storageKey);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.answers = parsed.answers || {};
            state.currentSectionIndex = parsed.currentSectionIndex || 0;
        } catch (e) {
            console.error('Error parsing saved progress', e);
        }
    }
}

function saveProgress() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        answers: state.answers,
        currentSectionIndex: state.currentSectionIndex
    }));
}

// --- Rendering ---

function renderSection() {
    const section = state.sections[state.currentSectionIndex];
    if (!section) return;

    // Hide explanation banner on new section load (optional)
    hideExplanation();

    // Update Header
    elements.sectionIndicator.textContent = `Section ${state.currentSectionIndex + 1} of ${state.sections.length}`;
    elements.sectionTitle.textContent = section.title;

    // Update Progress Bar
    const progress = ((state.currentSectionIndex + 1) / state.sections.length) * 100;
    elements.progressBarFill.style.width = `${progress}%`;

    // Render Questions
    elements.sectionContent.innerHTML = '';
    section.questions.forEach(question => {
        const questionEl = createQuestionElement(question);
        elements.sectionContent.appendChild(questionEl);
    });

    // Update Buttons
    elements.btnBack.classList.toggle('hidden', state.currentSectionIndex === 0);
    elements.btnNext.textContent = state.currentSectionIndex === state.sections.length - 1 ? 'Submit' : 'Next';

    // Restore values including conditional logic triggers
    restoreSectionValues();
}

function createQuestionElement(question) {
    const container = document.createElement('div');
    container.className = 'question-group';
    container.dataset.id = question.id;

    // Label Row
    const labelRow = document.createElement('div');
    labelRow.className = 'question-label-row';

    const label = document.createElement('label');
    label.className = 'question-label';
    label.textContent = question.label;
    label.htmlFor = question.id;
    labelRow.appendChild(label);

    // --- LOGIC CHANGE: Use SVG Icon calling Top Banner ---
    if (question.explanation) {
        const infoBtn = document.createElement('button');
        infoBtn.type = 'button';
        infoBtn.className = 'info-btn';
        infoBtn.setAttribute('aria-label', 'Show explanation');

        // SVG for a modern Info Circle
        infoBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
        `;

        // Now calls showExplanation (Top Box) instead of showPopover
        infoBtn.onclick = (e) => {
            e.preventDefault(); // prevent form issues
            showExplanation(question.explanation);
        };
        labelRow.appendChild(infoBtn);
    }

    container.appendChild(labelRow);

    // Input Container
    const inputContainer = document.createElement('div');
    inputContainer.className = 'input-container';
    inputContainer.appendChild(renderInput(question));
    container.appendChild(inputContainer);

    // Conditional Input Container
    const conditionalContainer = document.createElement('div');
    conditionalContainer.id = `conditional-${question.id}`;
    conditionalContainer.className = 'conditional-container hidden';
    container.appendChild(conditionalContainer);

    // Error Message Placeholder
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-message hidden';
    errorMsg.style.color = 'var(--error-color)';
    errorMsg.style.fontSize = '0.85rem';
    errorMsg.style.marginTop = '6px';
    container.appendChild(errorMsg);

    return container;
}

function renderInput(question) {
    const { input_type, id, options, placeholder, custom_label } = question;

    // Standard Inputs
    if (['text', 'email', 'url', 'number', 'date', 'textarea'].includes(input_type)) {
        const isArea = input_type === 'textarea';
        const el = document.createElement(isArea ? 'textarea' : 'input');
        if (!isArea) el.type = input_type;
        el.id = id;
        el.name = id;
        if (placeholder) el.placeholder = placeholder;
        el.addEventListener('input', (e) => updateAnswer(id, e.target.value));
        return el;
    }

    // Dropdowns
    if (input_type === 'dropdown' || input_type === 'dropdown_with_custom' || input_type === 'dropdown_with_conditional') {
        const select = document.createElement('select');
        select.id = id;
        select.name = id;

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select an option...';
        select.appendChild(defaultOption);

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            const val = e.target.value;
            updateAnswer(id, val);
            if (input_type === 'dropdown_with_custom') {
                toggleCustomInput(id, val, select.parentNode, custom_label);
            }
            if (input_type === 'dropdown_with_conditional') {
                handleConditionalLogic(question, val);
            }
        });
        return select;
    }

    // Radio Groups
    if (input_type.startsWith('radio')) {
        const radioGroup = document.createElement('div');
        radioGroup.className = 'radio-group';

        options.forEach(opt => {
            const wrapper = document.createElement('label');
            wrapper.className = 'radio-option';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = id;
            radio.value = opt;
            radio.addEventListener('change', (e) => {
                updateAnswer(id, e.target.value);
                if (input_type !== 'radio') {
                    handleConditionalLogic(question, e.target.value);
                }
            });

            wrapper.appendChild(radio);
            wrapper.appendChild(document.createTextNode(opt));
            radioGroup.appendChild(wrapper);
        });
        return radioGroup;
    }

    // Multi-select
    if (input_type === 'multiselect') {
        const checkGroup = document.createElement('div');
        checkGroup.className = 'checkbox-group';

        options.forEach(opt => {
            const wrapper = document.createElement('label');
            wrapper.className = 'checkbox-option';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = id;
            checkbox.value = opt;
            checkbox.addEventListener('change', () => {
                const selected = Array.from(checkGroup.querySelectorAll('input:checked')).map(cb => cb.value);
                updateAnswer(id, selected);
            });

            wrapper.appendChild(checkbox);
            wrapper.appendChild(document.createTextNode(opt));
            checkGroup.appendChild(wrapper);
        });
        return checkGroup;
    }

    // File Upload
    if (input_type === 'file_upload') {
        return createFileUpload(id);
    }

    return document.createElement('div');
}

function createFileUpload(id) {
    const fileContainer = document.createElement('div');
    fileContainer.className = 'file-upload-container';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = id;
    fileInput.className = 'file-input';
    fileInput.multiple = true;

    const labelText = document.createElement('div');
    labelText.innerHTML = `<span style="color:var(--text-main)">Click to Upload</span> or drag files`;

    const preview = document.createElement('div');
    preview.className = 'file-preview';

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            labelText.textContent = `${files.length} file(s) selected`;
            preview.textContent = files.map(f => f.name).join(', ');
            updateAnswer(id, `Files attached: ${files.map(f => f.name).join(', ')}`);
        }
    });

    fileContainer.appendChild(fileInput);
    fileContainer.appendChild(labelText);
    fileContainer.appendChild(preview);
    return fileContainer;
}

// --- Conditional Logic ---

function handleConditionalLogic(question, value) {
    const container = document.getElementById(`conditional-${question.id}`);
    if (!container) return;

    let shouldShow = false;
    if (question.input_type.startsWith('radio_then')) {
        shouldShow = (value === 'Yes');
    } else if (question.input_type === 'dropdown_with_conditional') {
        shouldShow = (value === question.conditional_option);
    }

    if (shouldShow) {
        container.innerHTML = '';
        container.classList.remove('hidden');

        if (question.child_label) {
            const label = document.createElement('label');
            label.className = 'conditional-label';
            label.textContent = question.child_label;
            container.appendChild(label);
        }

        const childId = `${question.id}_details`;
        let childInput;

        if (question.input_type === 'radio_then_text' || question.input_type === 'radio_then_list') {
            childInput = document.createElement('textarea');
            childInput.id = childId;
            childInput.placeholder = 'Please provide details...';
        }
        else if (question.input_type === 'radio_then_file') {
            childInput = createFileUpload(childId);
        }
        else if (question.input_type === 'dropdown_with_conditional' && question.child_type === 'dropdown') {
            childInput = document.createElement('select');
            childInput.id = childId;
            const def = document.createElement('option');
            def.value = '';
            def.textContent = 'Select...';
            childInput.appendChild(def);
            question.child_options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                childInput.appendChild(o);
            });
        }

        if (childInput) {
            if (childInput.tagName === 'SELECT' || childInput.tagName === 'TEXTAREA' || childInput.tagName === 'INPUT') {
                childInput.addEventListener(childInput.tagName === 'SELECT' ? 'change' : 'input', (e) => {
                    updateAnswer(childId, e.target.value);
                });
            }
            container.appendChild(childInput);

            if (state.answers[childId]) {
                if (childInput.tagName === 'TEXTAREA' || (childInput.tagName === 'INPUT' && childInput.type !== 'file') || childInput.tagName === 'SELECT') {
                    childInput.value = state.answers[childId];
                } else if (childInput.classList.contains('file-upload-container')) {
                    childInput.querySelector('.file-preview').textContent = state.answers[childId];
                }
            }
        }

    } else {
        container.classList.add('hidden');
        container.innerHTML = '';
    }
}

function toggleCustomInput(id, value, container, labelText) {
    let customInput = container.querySelector(`#${id}-custom`);
    if (value === 'Other') {
        if (!customInput) {
            customInput = document.createElement('input');
            customInput.type = 'text';
            customInput.id = `${id}-custom`;
            customInput.placeholder = labelText || 'Please specify...';
            customInput.style.marginTop = '10px';

            customInput.addEventListener('input', (e) => {
                state.answers[`${id}_custom`] = e.target.value;
                saveProgress();
            });
            if (state.answers[`${id}_custom`]) {
                customInput.value = state.answers[`${id}_custom`];
            }
            container.appendChild(customInput);
        }
    } else {
        if (customInput) {
            customInput.remove();
            delete state.answers[`${id}_custom`];
            saveProgress();
        }
    }
}

function updateAnswer(id, value) {
    state.answers[id] = value;
    saveProgress();
    const container = document.querySelector(`.question-group[data-id="${id}"]`);
    if (container) {
        const error = container.querySelector('.error-message');
        if (error) error.classList.add('hidden');
    }
}

function restoreSectionValues() {
    const section = state.sections[state.currentSectionIndex];
    section.questions.forEach(q => {
        const value = state.answers[q.id];
        if (value === undefined || value === null) return;

        const el = document.getElementById(q.id);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                if (el.type !== 'file' && el.type !== 'radio' && el.type !== 'checkbox') {
                    el.value = value;
                    if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change'));
                }
            }
        } else {
            const radios = document.getElementsByName(q.id);
            if (radios.length > 0) {
                radios.forEach(r => {
                    if (Array.isArray(value)) {
                        r.checked = value.includes(r.value);
                    } else {
                        r.checked = r.value === value;
                        if (r.checked && q.input_type.startsWith('radio')) {
                            handleConditionalLogic(q, value);
                        }
                    }
                });
            }
        }
    });
}

function validateSection() {
    return true;
}

// --- NEW: Explanation Banner Logic ---

function showExplanation(text) {
    elements.explanationText.textContent = text;
    elements.explanationBanner.classList.remove('hidden');
}

function hideExplanation() {
    elements.explanationBanner.classList.add('hidden');
}

// --- Navigation & Submission ---

function handleNext() {
    if (!validateSection()) return;

    if (state.currentSectionIndex < state.sections.length - 1) {
        elements.sectionContent.style.opacity = '0';
        elements.sectionContent.style.transform = 'translateX(-20px)';

        setTimeout(() => {
            state.currentSectionIndex++;
            renderSection();
            saveProgress();

            elements.sectionContent.style.opacity = '0';
            elements.sectionContent.style.transform = 'translateX(20px)';
            requestAnimationFrame(() => {
                elements.sectionContent.style.transition = 'all 0.3s ease-out';
                elements.sectionContent.style.opacity = '1';
                elements.sectionContent.style.transform = 'translateX(0)';
            });
            elements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    } else {
        submitForm();
    }
}

function handleBack() {
    if (state.currentSectionIndex > 0) {
        state.currentSectionIndex--;
        renderSection();
        saveProgress();
    }
}

async function submitForm() {
    if (state.isSubmitting) return;
    state.isSubmitting = true;
    elements.btnNext.textContent = 'Sending...';

    const formData = new FormData();
    formData.append('access_key', CONFIG.web3FormKey);
    formData.append('subject', 'New Project Requirements Submission');

    for (const [key, value] of Object.entries(state.answers)) {
        formData.append(key, Array.isArray(value) ? value.join(', ') : value);
    }

    document.querySelectorAll('input[type="file"]').forEach(input => {
        if (input.files.length > 0) {
            for (let i = 0; i < input.files.length; i++) {
                formData.append(input.id, input.files[i]);
            }
        }
    });

    try {
        const response = await fetch(CONFIG.web3FormUrl, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.success) {
            showThankYou();
            localStorage.removeItem(CONFIG.storageKey);
        } else {
            showToast(result.message || 'Submission failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        state.isSubmitting = false;
        if (state.currentSectionIndex < state.sections.length - 1) {
            elements.btnNext.textContent = 'Next';
        } else {
            elements.btnNext.textContent = 'Submit';
        }
    }
}

function showThankYou() {
    elements.form.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <div style="font-size: 3rem; margin-bottom: 20px;">🚀</div>
            <h2 style="color: var(--primary-accent); margin-bottom: 20px; font-size: 2rem;">Received!</h2>
            <p style="color: var(--text-muted); margin-bottom: 40px; font-size: 1.1rem; line-height: 1.6;">
                Thank you for detailing your project requirements.<br>
                We will review the information and get back to you within 24 hours.
            </p>
            <button onclick="location.reload()" class="btn btn-primary">Start New Project</button>
        </div>
    `;
    elements.sectionIndicator.style.display = 'none';
    elements.progressBarFill.style.width = '100%';
}

function showToast(message, type = 'success') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.remove('hidden');
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

function setupEventListeners() {
    elements.btnNext.addEventListener('click', handleNext);
    elements.btnBack.addEventListener('click', handleBack);
    elements.btnSave.addEventListener('click', () => {
        saveProgress();
        showToast('Progress saved!');
    });

    // Close Explanation Banner
    elements.closeExplanationBtn.addEventListener('click', hideExplanation);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideExplanation();
    });
}

function initBackground() {
    const canvas = elements.bgCanvas;
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.size = Math.random() * 2;
            this.color = Math.random() > 0.5 ? 'rgba(0, 242, 255, 0.3)' : 'rgba(112, 0, 255, 0.3)';
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < 50; i++) {
            particles.push(new Particle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
        resize();
        initParticles();
    });
    resize();
    initParticles();
    animate();
}

function handleIntroAnimation() {
    const overlay = document.getElementById('intro-overlay');
    // The CSS animation takes 2.5s to start fading out, and 0.5s to fade.
    // We wait 3 seconds total before setting display:none to be safe.
    setTimeout(() => {
        if (overlay) {
            // Hard remove from display flow so it can't block clicks
            overlay.style.display = 'none'; 
        }
    }, 3000);
}

// Start App
init();

// Start intro timer
handleIntroAnimation();