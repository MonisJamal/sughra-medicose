/* ============================================================
   SUGHRA MEDICOSE — World-Class Pharmacy Interactive Core
   Owner: Tasnim Jamal | WhatsApp: 7503564364 | Shahganj Chowk, Ajmeri Gate
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ===== 1. INITIALIZE LUCIDE ICONS =====
    function refreshLucideIcons() {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }
    refreshLucideIcons();

    // ===== 2. SYNTHESIZED WEB AUDIO API ENGINE (Micro-Sounds) =====
    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.enabled = localStorage.getItem('sm_sound_enabled') !== 'false';
        }

        initContext() {
            if (!this.ctx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    this.ctx = new AudioContext();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        playTone(freq = 440, type = 'sine', duration = 0.08, gainVal = 0.05) {
            if (!this.enabled) return;
            try {
                this.initContext();
                if (!this.ctx) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

                gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) {
                // Audio safety fallback
            }
        }

        playClick() {
            this.playTone(580, 'sine', 0.06, 0.04);
        }

        playAddCart() {
            if (!this.enabled) return;
            this.initContext();
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            [523.25, 659.25, 783.99, 1046.50].forEach((f, idx) => {
                setTimeout(() => {
                    this.playTone(f, 'triangle', 0.12, 0.04);
                }, idx * 45);
            });
        }

        playSuccess() {
            if (!this.enabled) return;
            this.initContext();
            if (!this.ctx) return;
            [440, 554.37, 659.25].forEach((f, idx) => {
                setTimeout(() => {
                    this.playTone(f, 'sine', 0.15, 0.05);
                }, idx * 60);
            });
        }

        playDelete() {
            this.playTone(280, 'sawtooth', 0.1, 0.03);
        }

        toggle() {
            this.enabled = !this.enabled;
            localStorage.setItem('sm_sound_enabled', this.enabled);
            if (this.enabled) this.playClick();
            return this.enabled;
        }
    }

    const soundFX = new SoundEngine();

    // Sound toggle button
    const soundToggle = document.getElementById('soundToggle');
    const soundIconOn = soundToggle?.querySelector('.sound-icon-on');
    const soundIconOff = soundToggle?.querySelector('.sound-icon-off');

    function updateSoundToggleUI(enabled) {
        if (!soundIconOn || !soundIconOff) return;
        if (enabled) {
            soundIconOn.style.display = 'block';
            soundIconOff.style.display = 'none';
        } else {
            soundIconOn.style.display = 'none';
            soundIconOff.style.display = 'block';
        }
    }
    updateSoundToggleUI(soundFX.enabled);

    soundToggle?.addEventListener('click', () => {
        const isEnabled = soundFX.toggle();
        updateSoundToggleUI(isEnabled);
    });

    // Attach sound feedback to elements
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-sound]');
        if (target) {
            const soundType = target.getAttribute('data-sound');
            if (soundType === 'click') soundFX.playClick();
            if (soundType === 'add') soundFX.playAddCart();
            if (soundType === 'success') soundFX.playSuccess();
        }
    });

    // ===== 3. PRELOADER WITH PERCENT PROGRESS =====
    const preloader = document.getElementById('preloader');
    const preloaderBar = document.getElementById('preloaderBar');
    const preloaderPercent = document.getElementById('preloaderPercent');

    let loadProgress = 0;
    const progressInterval = setInterval(() => {
        loadProgress += Math.floor(Math.random() * 20) + 10;
        if (loadProgress >= 100) {
            loadProgress = 100;
            clearInterval(progressInterval);
            if (preloaderBar) preloaderBar.style.width = '100%';
            if (preloaderPercent) preloaderPercent.textContent = '100%';
            setTimeout(() => {
                preloader?.classList.add('fade-out');
            }, 300);
        } else {
            if (preloaderBar) preloaderBar.style.width = `${loadProgress}%`;
            if (preloaderPercent) preloaderPercent.textContent = `${loadProgress}%`;
        }
    }, 80);

    // ===== 4. THEME CONTROLLER (Dark/Light Mode) =====
    const themeToggle = document.getElementById('themeToggle');
    const themeIconLight = themeToggle?.querySelector('.theme-icon-light');
    const themeIconDark = themeToggle?.querySelector('.theme-icon-dark');

    const savedTheme = localStorage.getItem('sm_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggleUI(savedTheme);

    function updateThemeToggleUI(theme) {
        if (!themeIconLight || !themeIconDark) return;
        if (theme === 'dark') {
            themeIconLight.style.display = 'block';
            themeIconDark.style.display = 'none';
        } else {
            themeIconLight.style.display = 'none';
            themeIconDark.style.display = 'block';
        }
    }

    themeToggle?.addEventListener('click', () => {
        soundFX.playClick();
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('sm_theme', newTheme);
        updateThemeToggleUI(newTheme);
    });

    // ===== 5. REALTIME STORE STATUS & CLOCK TICKER =====
    function updateStoreStatus() {
        const statusEl = document.getElementById('liveStoreStatus');
        if (!statusEl) return;

        const now = new Date();
        // Indian Standard Time (IST) offset is UTC+5:30
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const istDate = new Date(utc + (3600000 * 5.5));
        const hour = istDate.getHours();
        const day = istDate.getDay(); // 0 is Sunday

        let isOpen = false;
        if (day === 0) {
            // Sunday: 10:00 AM - 8:00 PM (10 to 20)
            isOpen = hour >= 10 && hour < 20;
        } else {
            // Mon - Sat: 9:00 AM - 10:00 PM (9 to 22)
            isOpen = hour >= 9 && hour < 22;
        }

        if (isOpen) {
            statusEl.innerHTML = `🟢 <strong>Open Now</strong> • Dispensing Genuine Medicines at Shahganj Chowk`;
        } else {
            statusEl.innerHTML = `🌙 <strong>Night Emergency Hotline Active</strong> • Call <strong>7503564364</strong>`;
        }
    }
    updateStoreStatus();
    setInterval(updateStoreStatus, 60000);

    // ===== 6. INTERACTIVE BIO-CANVAS PARTICLES & MOLECULAR MESH =====
    const canvas = document.getElementById('heroCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let animId;
        const mouse = { x: null, y: null, radius: 140 };

        function setCanvasDimensions() {
            canvas.width = canvas.parentElement.offsetWidth || window.innerWidth;
            canvas.height = canvas.parentElement.offsetHeight || window.innerHeight;
        }
        setCanvasDimensions();
        window.addEventListener('resize', () => {
            setCanvasDimensions();
            createParticles();
        });

        class MoleculeNode {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2.5 + 1;
                this.vx = (Math.random() - 0.5) * 0.7;
                this.vy = (Math.random() - 0.5) * 0.7;
                this.isAmber = Math.random() > 0.8;
                this.color = this.isAmber ? '245, 158, 11' : '16, 185, 129';
                this.alpha = Math.random() * 0.5 + 0.2;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Bounce at canvas bounds
                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

                // Mouse interactivity
                if (mouse.x !== null && mouse.y !== null) {
                    const dx = this.x - mouse.x;
                    const dy = this.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < mouse.radius) {
                        const angle = Math.atan2(dy, dx);
                        const force = (mouse.radius - dist) / mouse.radius;
                        this.x += Math.cos(angle) * force * 1.5;
                        this.y += Math.sin(angle) * force * 1.5;
                    }
                }
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
                ctx.fill();
            }
        }

        function createParticles() {
            const count = Math.min(Math.floor((canvas.width * canvas.height) / 9500), 120);
            particles = [];
            for (let i = 0; i < count; i++) {
                particles.push(new MoleculeNode());
            }
        }
        createParticles();

        function connectParticles() {
            const maxDist = 110;
            for (let a = 0; a < particles.length; a++) {
                for (let b = a + 1; b < particles.length; b++) {
                    const dx = particles[a].x - particles[b].x;
                    const dy = particles[a].y - particles[b].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < maxDist) {
                        const alpha = (1 - dist / maxDist) * 0.22;
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
                        ctx.lineWidth = 0.75;
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.stroke();
                    }
                }
            }
        }

        function animateCanvas() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            connectParticles();
            animId = requestAnimationFrame(animateCanvas);
        }
        animateCanvas();

        window.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });

        window.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });
    }

    // ===== 7. CURSOR GLOW =====
    const cursorGlow = document.getElementById('cursorGlow');
    if (cursorGlow && window.innerWidth > 768) {
        let mouseX = 0, mouseY = 0;
        let currentX = 0, currentY = 0;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function renderGlow() {
            currentX += (mouseX - currentX) * 0.1;
            currentY += (mouseY - currentY) * 0.1;
            cursorGlow.style.left = `${currentX}px`;
            cursorGlow.style.top = `${currentY}px`;
            requestAnimationFrame(renderGlow);
        }
        renderGlow();
    }

    // ===== 8. SCROLL REVEAL & HEADER BEHAVIOR =====
    const header = document.getElementById('header');
    const backToTop = document.getElementById('backToTop');
    const revealItems = document.querySelectorAll('.reveal-item');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach(item => revealObserver.observe(item));

    window.addEventListener('scroll', () => {
        const y = window.scrollY;
        if (y > 40) {
            header?.classList.add('scrolled');
        } else {
            header?.classList.remove('scrolled');
        }

        if (y > 400) {
            backToTop?.classList.add('visible');
        } else {
            backToTop?.classList.remove('visible');
        }
    }, { passive: true });

    backToTop?.addEventListener('click', () => {
        soundFX.playClick();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ===== 9. ANIMATED STAT COUNTERS =====
    const statNums = document.querySelectorAll('.stat-num[data-target]');
    const statObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.getAttribute('data-target'), 10);
                const duration = 1800;
                const start = performance.now();

                function countStep(timestamp) {
                    const progress = Math.min((timestamp - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    const currentVal = Math.floor(eased * target);

                    el.textContent = currentVal.toLocaleString('en-IN');

                    if (progress < 1) {
                        requestAnimationFrame(countStep);
                    } else {
                        el.textContent = target.toLocaleString('en-IN');
                    }
                }
                requestAnimationFrame(countStep);
                statObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    statNums.forEach(n => statObserver.observe(n));

    // ===== 10. MOBILE MENU & BOTTOM NAV =====
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navMenu = document.getElementById('navMenu');

    hamburgerBtn?.addEventListener('click', () => {
        soundFX.playClick();
        navMenu?.classList.toggle('open');
    });

    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', () => {
            navMenu?.classList.remove('open');
        });
    });

    // ===== 11. MEDICINE CATALOG DATABASE =====
    const MEDICINES_DATABASE = [
        {
            id: 'med-1',
            name: 'Augmentin 625 Duo Tablet',
            category: 'rx',
            categoryName: 'Prescription Rx',
            brand: 'GSK Pharma',
            salt: 'Amoxicillin (500mg) + Clavulanic Acid (125mg)',
            price: 204,
            mrp: 235,
            discount: '13% OFF',
            dosage: '1 Strip (10 Tablets)',
            prescriptionRequired: true,
            image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
            description: 'Powerful broad-spectrum antibiotic prescribed for bacterial respiratory infections, ear, sinus, throat, skin, and urinary tract infections.',
            usage: 'Take with or after food as prescribed by a qualified doctor.',
            storage: 'Store below 25°C in a dry place.'
        },
        {
            id: 'med-2',
            name: 'Telma 40mg Tablet',
            category: 'rx',
            categoryName: 'Prescription Rx',
            brand: 'Glenmark Pharmaceuticals',
            salt: 'Telmisartan (40mg)',
            price: 185,
            mrp: 215,
            discount: '14% OFF',
            dosage: '1 Strip (15 Tablets)',
            prescriptionRequired: true,
            image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&auto=format&fit=crop&q=80',
            description: 'Angiotensin receptor blocker used to manage high blood pressure (hypertension) and lower cardiovascular risks.',
            usage: 'Take daily at the same time, with or without meals.',
            storage: 'Keep away from direct sunlight.'
        },
        {
            id: 'med-3',
            name: 'Glycomet GP 2 Tablet PR',
            category: 'rx',
            categoryName: 'Prescription Rx',
            brand: 'USV Private Limited',
            salt: 'Metformin (500mg) + Glimepiride (2mg)',
            price: 198,
            mrp: 228,
            discount: '13% OFF',
            dosage: '1 Strip (15 Tablets)',
            prescriptionRequired: true,
            image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&auto=format&fit=crop&q=80',
            description: 'Combination anti-diabetic medication used along with diet and exercise to improve blood sugar control in Type 2 Diabetes.',
            usage: 'Take with breakfast or first main meal of the day.',
            storage: 'Protect from moisture.'
        },
        {
            id: 'med-4',
            name: 'Pantocid DSR Capsule',
            category: 'rx',
            categoryName: 'Prescription Rx',
            brand: 'Sun Pharma',
            salt: 'Pantoprazole (40mg) + Domperidone (30mg)',
            price: 210,
            mrp: 245,
            discount: '14% OFF',
            dosage: '1 Strip (15 Capsules)',
            prescriptionRequired: true,
            image: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&auto=format&fit=crop&q=80',
            description: 'Provides rapid relief from acidity, GERD, acid reflux, heartburn, and nausea by reducing excess gastric acid.',
            usage: 'Take in the morning on an empty stomach (30 mins before breakfast).',
            storage: 'Store in cool and dry place.'
        },
        {
            id: 'med-5',
            name: 'Rosuvas 10mg Tablet',
            category: 'rx',
            categoryName: 'Prescription Rx',
            brand: 'Sun Pharma',
            salt: 'Rosuvastatin (10mg)',
            price: 245,
            mrp: 290,
            discount: '15% OFF',
            dosage: '1 Strip (15 Tablets)',
            prescriptionRequired: true,
            image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400&auto=format&fit=crop&q=80',
            description: 'Statin cholesterol medication used to lower bad cholesterol (LDL) and triglycerides, and raise good cholesterol (HDL).',
            usage: 'Take once daily at bedtime.',
            storage: 'Store at room temperature.'
        },
        {
            id: 'med-6',
            name: 'Dolo 650mg Paracetamol Tablet',
            category: 'otc',
            categoryName: 'OTC & First Aid',
            brand: 'Micro Labs Ltd',
            salt: 'Paracetamol (650mg)',
            price: 32,
            mrp: 36,
            discount: '11% OFF',
            dosage: '1 Strip (15 Tablets)',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
            description: 'India\'s most trusted fever and pain reducer. Relieves headaches, body aches, toothaches, and viral fever symptoms.',
            usage: 'Take 1 tablet after food every 6 to 8 hours as needed.',
            storage: 'Store in a cool, dark place.'
        },
        {
            id: 'med-7',
            name: 'Betadine 10% Antiseptic Ointment',
            category: 'otc',
            categoryName: 'OTC & First Aid',
            brand: 'Win-Medicare',
            salt: 'Povidone Iodine (10% w/w)',
            price: 115,
            mrp: 135,
            discount: '15% OFF',
            dosage: '20g Tube',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&auto=format&fit=crop&q=80',
            description: 'Gold standard topical antiseptic microbicide for the treatment and prevention of infection in cuts, burns, wounds, and abrasions.',
            usage: 'Clean wound and apply gently 1 to 2 times daily.',
            storage: 'Store below 25°C.'
        },
        {
            id: 'med-8',
            name: 'Volini Pain Relief Gel',
            category: 'otc',
            categoryName: 'OTC & First Aid',
            brand: 'Sun Pharma',
            salt: 'Diclofenac Diethylamine + Methyl Salicylate + Menthol',
            price: 130,
            mrp: 155,
            discount: '16% OFF',
            dosage: '50g Tube',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1608248597359-07490088cb37?w=400&auto=format&fit=crop&q=80',
            description: 'Fast-acting gel that deeply penetrates to relieve neck pain, shoulder pain, sprains, muscle stiffness, and joint aches.',
            usage: 'Gently massage onto affected area 3 to 4 times a day.',
            storage: 'For external use only.'
        },
        {
            id: 'med-9',
            name: 'Omron HEM 7120 Digital BP Monitor',
            category: 'devices',
            categoryName: 'Medical Devices',
            brand: 'Omron Healthcare',
            salt: 'IntelliSense Technology • Arm Cuff',
            price: 1999,
            mrp: 2450,
            discount: '18% OFF',
            dosage: '1 Unit (3 Years Warranty)',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&auto=format&fit=crop&q=80',
            description: 'Clinically validated accurate digital blood pressure monitor with hypertension indicator, body movement detector, and memory recording.',
            usage: 'Measure sitting quietly for 5 mins with cuff at heart level.',
            storage: 'Keep in protective case.'
        },
        {
            id: 'med-10',
            name: 'Accu-Chek Active Blood Glucose Monitor',
            category: 'devices',
            categoryName: 'Medical Devices',
            brand: 'Roche Diabetes Care',
            salt: 'Glucometer + 10 Free Test Strips + Lancing Device',
            price: 1249,
            mrp: 1599,
            discount: '22% OFF',
            dosage: 'Complete Kit',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&auto=format&fit=crop&q=80',
            description: 'Accurate and simple blood glucose monitoring device providing results in under 5 seconds with hassle-free test strip handling.',
            usage: 'Use clean lancet for blood droplet and insert strip.',
            storage: 'Store test strips tightly closed.'
        },
        {
            id: 'med-11',
            name: 'Dr. Morepen Compressor Nebulizer (CN-10)',
            category: 'devices',
            categoryName: 'Medical Devices',
            brand: 'Dr. Morepen',
            salt: 'Compact Medical Aerosol Delivery Kit',
            price: 1450,
            mrp: 1890,
            discount: '23% OFF',
            dosage: '1 Device with Adult & Child Mask',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
            description: 'Low-noise respiratory nebulizer system for effective medication delivery for asthma, bronchitis, COPD, and allergic cough.',
            usage: 'Add prescribed respiratory solution into medicine chamber.',
            storage: 'Clean mask and tubing with warm water after each use.'
        },
        {
            id: 'med-12',
            name: 'Becosules Z Multivitamin Capsules',
            category: 'wellness',
            categoryName: 'Vitamins & Wellness',
            brand: 'Pfizer Ltd',
            salt: 'Vitamin B-Complex + Vitamin C + Zinc',
            price: 48,
            mrp: 56,
            discount: '14% OFF',
            dosage: '1 Strip (20 Capsules)',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400&auto=format&fit=crop&q=80',
            description: 'Essential daily immunity supplement that cures mouth ulcers, fights fatigue, supports metabolism, and promotes healthy skin and hair.',
            usage: 'Take 1 capsule daily after a meal.',
            storage: 'Keep in dry, cool place.'
        },
        {
            id: 'med-13',
            name: 'Limcee 500mg Chewable Vitamin C',
            category: 'wellness',
            categoryName: 'Vitamins & Wellness',
            brand: 'Abbott Healthcare',
            salt: 'Ascorbic Acid (Vitamin C 500mg) Orange Flavor',
            price: 24,
            mrp: 28,
            discount: '14% OFF',
            dosage: '1 Strip (15 Chewable Tabs)',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&auto=format&fit=crop&q=80',
            description: 'Tasty chewable antioxidant supplement that strengthens your immune defense against seasonal infections, colds, and flu.',
            usage: 'Chew 1 tablet daily.',
            storage: 'Store away from sunlight.'
        },
        {
            id: 'med-14',
            name: 'Shelcal 500mg Calcium + Vitamin D3',
            category: 'wellness',
            categoryName: 'Vitamins & Wellness',
            brand: 'Torrent Pharmaceuticals',
            salt: 'Elemental Calcium (500mg) + Vitamin D3 (250 IU)',
            price: 125,
            mrp: 148,
            discount: '15% OFF',
            dosage: '1 Strip (15 Tablets)',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&auto=format&fit=crop&q=80',
            description: 'Promotes strong bone density, healthy joint mobility, and prevents osteoporosis and calcium deficiency.',
            usage: 'Take 1 tablet daily after milk or food.',
            storage: 'Store in cool place.'
        },
        {
            id: 'med-15',
            name: 'Sebamed Baby Gentle Wash (200ml)',
            category: 'baby',
            categoryName: 'Baby & Mother Care',
            brand: 'Sebamed Germany',
            salt: 'pH 5.5 Sugar Tenside Complex • 100% Soap Free',
            price: 440,
            mrp: 499,
            discount: '12% OFF',
            dosage: '200ml Bottle',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&auto=format&fit=crop&q=80',
            description: 'Dermatologically formulated extra-mild cleanser for delicate baby skin, protecting natural lipid barrier with tear-free formula.',
            usage: 'Apply small amount on baby skin during bath.',
            storage: 'Keep cap tightly closed.'
        },
        {
            id: 'med-16',
            name: 'Woodward\'s Gripe Water (130ml)',
            category: 'baby',
            categoryName: 'Baby & Mother Care',
            brand: 'TTK Healthcare',
            salt: 'Sarjikakshara + Dill Oil',
            price: 65,
            mrp: 75,
            discount: '13% OFF',
            dosage: '130ml Bottle',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&auto=format&fit=crop&q=80',
            description: 'Ayurvedic formulation for infant relief from stomach gas, colic pain, indigestion, and teething discomfort.',
            usage: 'Administer using dropper as directed on packaging.',
            storage: 'Shake well before use.'
        },
        {
            id: 'med-17',
            name: 'Dabur Chyawanprash 2X Immunity (1kg)',
            category: 'ayurveda',
            categoryName: 'Ayurvedic & Herbal',
            brand: 'Dabur India',
            salt: '40+ Ayurvedic Herbs • Amla, Ashwagandha, Pippali',
            price: 385,
            mrp: 440,
            discount: '12% OFF',
            dosage: '1kg Jar',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&auto=format&fit=crop&q=80',
            description: 'Time-tested Ayurvedic formulation with Amla and herbs providing 2X immunity against coughs, colds, and seasonal fatigue.',
            usage: 'Take 1 teaspoon twice daily with warm milk.',
            storage: 'Keep jar tightly sealed.'
        },
        {
            id: 'med-18',
            name: 'Himalaya Liv.52 DS Tablets',
            category: 'ayurveda',
            categoryName: 'Ayurvedic & Herbal',
            brand: 'Himalaya Wellness',
            salt: 'Himsra + Kasani Double Strength Extract',
            price: 175,
            mrp: 200,
            discount: '12% OFF',
            dosage: 'Bottle (60 Tablets)',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=400&auto=format&fit=crop&q=80',
            description: 'Herbal hepatoprotective formula that restores liver functional efficiency, improves appetite, and supports healthy digestion.',
            usage: 'Take 1 to 2 tablets twice daily before meals.',
            storage: 'Store in a dry place.'
        },
        {
            id: 'med-19',
            name: 'Cetaphil Gentle Skin Cleanser (250ml)',
            category: 'derma',
            categoryName: 'Dermatology & Personal',
            brand: 'Galderma',
            salt: 'Niacinamide + Panthenol + Glycerin (Hydrating)',
            price: 525,
            mrp: 599,
            discount: '12% OFF',
            dosage: '250ml Pump Bottle',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&auto=format&fit=crop&q=80',
            description: 'Dermatologist recommended daily hydrating cleanser for sensitive, dry, or acne-prone skin that cleanses without stripping moisture.',
            usage: 'Apply to face, massage gently, and rinse or wipe off.',
            storage: 'Keep in room temperature.'
        },
        {
            id: 'med-20',
            name: 'La Shield Sunscreen Gel SPF 50+ PA+++',
            category: 'derma',
            categoryName: 'Dermatology & Personal',
            brand: 'Glenmark Pharmaceuticals',
            salt: 'Broad Spectrum UVA/UVB • Matte Non-Greasy',
            price: 645,
            mrp: 750,
            discount: '14% OFF',
            dosage: '50g Tube',
            prescriptionRequired: false,
            image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400&auto=format&fit=crop&q=80',
            description: 'Non-comedogenic, oil-free dermatological sunscreen gel that shields against sunburn, skin tanning, and premature photo-aging.',
            usage: 'Apply liberally on exposed skin 20 minutes before stepping out.',
            storage: 'Keep out of direct sunlight.'
        }
    ];

    // ===== 12. POPULATE & FILTER CATALOG =====
    const productsGrid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('medicineSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const catPills = document.querySelectorAll('.cat-pill');

    let currentCategory = 'all';
    let currentSearchTerm = '';

    function updateCategoryCounts() {
        const counts = {
            all: MEDICINES_DATABASE.length,
            rx: 0, otc: 0, devices: 0, wellness: 0, baby: 0, ayurveda: 0, derma: 0
        };

        MEDICINES_DATABASE.forEach(m => {
            if (counts[m.category] !== undefined) {
                counts[m.category]++;
            }
        });

        document.getElementById('countAll').textContent = counts.all;
        document.getElementById('countRx').textContent = counts.rx;
        document.getElementById('countOtc').textContent = counts.otc;
        document.getElementById('countDevices').textContent = counts.devices;
        document.getElementById('countWellness').textContent = counts.wellness;
        document.getElementById('countBaby').textContent = counts.baby;
        document.getElementById('countAyurveda').textContent = counts.ayurveda;
        document.getElementById('countDerma').textContent = counts.derma;
    }
    updateCategoryCounts();

    function renderCatalog() {
        if (!productsGrid) return;

        const filtered = MEDICINES_DATABASE.filter(med => {
            const matchCat = currentCategory === 'all' || med.category === currentCategory;
            const query = currentSearchTerm.toLowerCase();
            const matchSearch = !query ||
                med.name.toLowerCase().includes(query) ||
                med.salt.toLowerCase().includes(query) ||
                med.brand.toLowerCase().includes(query) ||
                med.description.toLowerCase().includes(query);
            return matchCat && matchSearch;
        });

        if (filtered.length === 0) {
            productsGrid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        productsGrid.innerHTML = filtered.map(med => `
            <div class="product-card" data-id="${med.id}">
                <div class="card-top-badges">
                    <span class="discount-badge">${med.discount}</span>
                    ${med.prescriptionRequired ? '<span class="rx-required-tag"><i data-lucide="file-text" style="width:12px;height:12px;"></i> Rx Required</span>' : ''}
                </div>

                <div class="product-thumb-box">
                    <img src="${med.image}" alt="${med.name}" loading="lazy">
                </div>

                <span class="product-meta-brand">${med.brand}</span>
                <h4 class="product-title">${med.name}</h4>
                <p class="product-salt">${med.salt}</p>

                <div class="product-pricing-row">
                    <span class="sale-price">₹${med.price}</span>
                    <span class="mrp-price">₹${med.mrp}</span>
                </div>

                <div class="product-actions-row">
                    <button class="btn-add-cart" data-id="${med.id}" data-sound="add">
                        <i data-lucide="shopping-bag" style="width:15px;height:15px;"></i> Add to Cart
                    </button>
                    <button class="btn-quick-view" data-id="${med.id}" title="Quick View">
                        <i data-lucide="eye" style="width:16px;height:16px;"></i>
                    </button>
                </div>
            </div>
        `).join('');

        refreshLucideIcons();
    }

    renderCatalog();

    // Category click handler
    catPills.forEach(pill => {
        pill.addEventListener('click', () => {
            soundFX.playClick();
            catPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentCategory = pill.getAttribute('data-category');
            renderCatalog();
        });
    });

    // Search input handler
    searchInput?.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.trim();
        if (clearSearchBtn) {
            clearSearchBtn.style.display = currentSearchTerm ? 'block' : 'none';
        }
        renderCatalog();
    });

    clearSearchBtn?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        currentSearchTerm = '';
        clearSearchBtn.style.display = 'none';
        renderCatalog();
    });

    // Footer category filter click
    document.querySelectorAll('[data-filter]').forEach(el => {
        el.addEventListener('click', (e) => {
            const filterVal = el.getAttribute('data-filter');
            const targetPill = document.querySelector(`.cat-pill[data-category="${filterVal}"]`);
            if (targetPill) {
                targetPill.click();
            }
        });
    });

    // ===== 13. QUICK VIEW MODAL =====
    const quickViewModal = document.getElementById('quickViewModal');
    const quickViewContent = document.getElementById('quickViewContent');
    const closeQuickViewBtn = document.getElementById('closeQuickViewBtn');

    function openQuickView(medId) {
        soundFX.playClick();
        const med = MEDICINES_DATABASE.find(m => m.id === medId);
        if (!med || !quickViewContent) return;

        quickViewContent.innerHTML = `
            <div class="modal-product-grid">
                <div class="modal-img-wrap">
                    <img src="${med.image}" alt="${med.name}">
                </div>
                <div class="modal-body">
                    <span class="product-meta-brand">${med.brand} • ${med.categoryName}</span>
                    <h3>${med.name}</h3>
                    <p class="modal-salt"><strong>Composition:</strong> ${med.salt}</p>
                    
                    <div class="modal-pricing">
                        ₹${med.price} <span class="mrp-price" style="font-size:1rem;margin-left:0.5rem;">MRP ₹${med.mrp}</span>
                        <span class="discount-badge" style="margin-left:0.5rem;">${med.discount}</span>
                    </div>

                    <div class="modal-details-list">
                        <p><strong>📋 Description:</strong> ${med.description}</p>
                        <p><strong>💡 Dosage Advice:</strong> ${med.usage}</p>
                        <p><strong>🛡️ Storage:</strong> ${med.storage}</p>
                    </div>

                    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:1.5rem;">
                        <button class="btn btn-primary-glow btn-lg modal-add-btn" data-id="${med.id}">
                            <i data-lucide="shopping-cart"></i> Add to Cart (₹${med.price})
                        </button>
                        <a href="https://wa.me/917503564364?text=Hello%20Sughra%20Medicose!%20I%20want%20to%20order%20${encodeURIComponent(med.name)}%20(₹${med.price})."
                            target="_blank" rel="noopener" class="btn btn-whatsapp-glow btn-lg">
                            <i data-lucide="message-square"></i> Order on WhatsApp
                        </a>
                    </div>
                </div>
            </div>
        `;

        refreshLucideIcons();
        quickViewModal?.classList.add('open');

        // Attach event to modal Add button
        quickViewContent.querySelector('.modal-add-btn')?.addEventListener('click', () => {
            addToCart(med.id);
            quickViewModal?.classList.remove('open');
        });
    }

    closeQuickViewBtn?.addEventListener('click', () => {
        quickViewModal?.classList.remove('open');
    });

    quickViewModal?.addEventListener('click', (e) => {
        if (e.target === quickViewModal) {
            quickViewModal.classList.remove('open');
        }
    });

    // Delegate quick view & add to cart on catalog
    productsGrid?.addEventListener('click', (e) => {
        const quickBtn = e.target.closest('.btn-quick-view');
        if (quickBtn) {
            const id = quickBtn.getAttribute('data-id');
            openQuickView(id);
            return;
        }

        const addBtn = e.target.closest('.btn-add-cart');
        if (addBtn) {
            const id = addBtn.getAttribute('data-id');
            addToCart(id);
        }
    });

    // ===== 14. SHOPPING CART & WHATSAPP CHECKOUT ENGINE =====
    let cart = JSON.parse(localStorage.getItem('sm_cart') || '[]');
    let appliedCoupon = null;

    const cartDrawer = document.getElementById('cartDrawer');
    const cartOverlay = document.getElementById('cartOverlay');
    const openCartBtn = document.getElementById('openCartBtn');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const mobileCartTrigger = document.getElementById('mobileCartTrigger');
    const cartExploreBtn = document.getElementById('cartExploreBtn');

    const cartCountEl = document.getElementById('cartCount');
    const cartDrawerCountEl = document.getElementById('cartDrawerCount');
    const mobileCartCountEl = document.getElementById('mobileCartCount');
    const cartItemsList = document.getElementById('cartItemsList');
    const cartEmptyView = document.getElementById('cartEmptyView');
    const cartFooter = document.getElementById('cartFooter');

    const billSubtotal = document.getElementById('billSubtotal');
    const billDiscount = document.getElementById('billDiscount');
    const discountRow = document.getElementById('discountRow');
    const billTotal = document.getElementById('billTotal');
    const couponInput = document.getElementById('couponInput');
    const applyCouponBtn = document.getElementById('applyCouponBtn');
    const couponMessage = document.getElementById('couponMessage');
    const checkoutWhatsAppBtn = document.getElementById('checkoutWhatsAppBtn');

    function saveCart() {
        localStorage.setItem('sm_cart', JSON.stringify(cart));
        updateCartUI();
    }

    function addToCart(medId) {
        soundFX.playAddCart();
        const med = MEDICINES_DATABASE.find(m => m.id === medId);
        if (!med) return;

        const existing = cart.find(item => item.id === medId);
        if (existing) {
            existing.qty += 1;
        } else {
            cart.push({
                id: med.id,
                name: med.name,
                price: med.price,
                mrp: med.mrp,
                image: med.image,
                qty: 1
            });
        }

        saveCart();
        openCartDrawer();
    }

    function updateCartUI() {
        const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
        if (cartCountEl) cartCountEl.textContent = totalItems;
        if (cartDrawerCountEl) cartDrawerCountEl.textContent = totalItems;
        if (mobileCartCountEl) mobileCartCountEl.textContent = totalItems;

        if (cart.length === 0) {
            if (cartItemsList) cartItemsList.innerHTML = '';
            if (cartEmptyView) cartEmptyView.style.display = 'flex';
            if (cartFooter) cartFooter.style.display = 'none';
            return;
        }

        if (cartEmptyView) cartEmptyView.style.display = 'none';
        if (cartFooter) cartFooter.style.display = 'block';

        if (cartItemsList) {
            cartItemsList.innerHTML = cart.map(item => `
                <div class="cart-item-card" data-id="${item.id}">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                    <div class="cart-item-info">
                        <h5>${item.name}</h5>
                        <span class="item-price">₹${item.price} each</span>
                    </div>
                    <div class="cart-item-qty-row">
                        <button class="qty-btn btn-qty-minus" data-id="${item.id}">-</button>
                        <span class="qty-val">${item.qty}</span>
                        <button class="qty-btn btn-qty-plus" data-id="${item.id}">+</button>
                    </div>
                </div>
            `).join('');
        }

        // Calculate bill
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        let discountAmount = 0;

        if (appliedCoupon === 'SUGHRA10') {
            discountAmount = Math.round(subtotal * 0.10);
        } else if (appliedCoupon === 'FIRSTAID50') {
            discountAmount = Math.min(50, subtotal);
        }

        const total = Math.max(0, subtotal - discountAmount);

        if (billSubtotal) billSubtotal.textContent = `₹${subtotal}`;
        if (discountAmount > 0) {
            if (discountRow) discountRow.style.display = 'flex';
            if (billDiscount) billDiscount.textContent = `- ₹${discountAmount}`;
        } else {
            if (discountRow) discountRow.style.display = 'none';
        }
        if (billTotal) billTotal.textContent = `₹${total}`;
    }

    updateCartUI();

    function openCartDrawer() {
        cartDrawer?.classList.add('open');
        cartOverlay?.classList.add('active');
    }

    function closeCartDrawer() {
        cartDrawer?.classList.remove('open');
        cartOverlay?.classList.remove('active');
    }

    openCartBtn?.addEventListener('click', () => {
        soundFX.playClick();
        openCartDrawer();
    });

    mobileCartTrigger?.addEventListener('click', () => {
        soundFX.playClick();
        openCartDrawer();
    });

    closeCartBtn?.addEventListener('click', closeCartDrawer);
    cartOverlay?.addEventListener('click', closeCartDrawer);
    cartExploreBtn?.addEventListener('click', closeCartDrawer);

    // Quantity modifiers
    cartItemsList?.addEventListener('click', (e) => {
        const minus = e.target.closest('.btn-qty-minus');
        if (minus) {
            const id = minus.getAttribute('data-id');
            const item = cart.find(i => i.id === id);
            if (item) {
                item.qty -= 1;
                if (item.qty <= 0) {
                    cart = cart.filter(i => i.id !== id);
                    soundFX.playDelete();
                } else {
                    soundFX.playClick();
                }
                saveCart();
            }
            return;
        }

        const plus = e.target.closest('.btn-qty-plus');
        if (plus) {
            const id = plus.getAttribute('data-id');
            const item = cart.find(i => i.id === id);
            if (item) {
                item.qty += 1;
                soundFX.playClick();
                saveCart();
            }
        }
    });

    // Coupon verification
    applyCouponBtn?.addEventListener('click', () => {
        const code = (couponInput?.value || '').trim().toUpperCase();
        if (!couponMessage) return;

        if (code === 'SUGHRA10') {
            appliedCoupon = 'SUGHRA10';
            couponMessage.className = 'coupon-feedback success';
            couponMessage.textContent = '🎉 10% Special Discount Applied!';
            couponMessage.style.display = 'block';
            soundFX.playSuccess();
        } else if (code === 'FIRSTAID50') {
            appliedCoupon = 'FIRSTAID50';
            couponMessage.className = 'coupon-feedback success';
            couponMessage.textContent = '🎉 ₹50 Instant Voucher Applied!';
            couponMessage.style.display = 'block';
            soundFX.playSuccess();
        } else {
            appliedCoupon = null;
            couponMessage.className = 'coupon-feedback error';
            couponMessage.textContent = '❌ Invalid coupon code. Try SUGHRA10';
            couponMessage.style.display = 'block';
            soundFX.playDelete();
        }
        updateCartUI();
    });

    // 1-Click WhatsApp Checkout Order Generator
    checkoutWhatsAppBtn?.addEventListener('click', () => {
        if (cart.length === 0) return;

        const customerName = document.getElementById('cartCustomerName')?.value.trim();
        const customerAddress = document.getElementById('cartCustomerAddress')?.value.trim();

        if (!customerName || !customerAddress) {
            alert('Please enter your Name and Delivery Address to complete your WhatsApp order.');
            return;
        }

        soundFX.playSuccess();

        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        let discountAmount = 0;
        if (appliedCoupon === 'SUGHRA10') discountAmount = Math.round(subtotal * 0.10);
        if (appliedCoupon === 'FIRSTAID50') discountAmount = Math.min(50, subtotal);
        const total = Math.max(0, subtotal - discountAmount);

        let itemsText = cart.map((item, idx) => `${idx + 1}. *${item.name}* (Qty: ${item.qty}) = ₹${item.price * item.qty}`).join('\n');

        const message =
`🏥 *NEW MEDICINE ORDER — SUGHRA MEDICOSE*
━━━━━━━━━━━━━━━━━━━━
👤 *Customer Name:* ${customerName}
📍 *Delivery Address:* ${customerAddress}
📞 *Store Hotline:* +91 7503564364
👨‍⚕️ *Chief Pharmacist:* Tasnim Jamal
━━━━━━━━━━━━━━━━━━━━
📦 *ORDERED MEDICINES:*
${itemsText}
━━━━━━━━━━━━━━━━━━━━
💵 *Subtotal:* ₹${subtotal}
${discountAmount > 0 ? `🎟️ *Discount (${appliedCoupon}):* -₹${discountAmount}\n` : ''}🛵 *Delivery:* FREE (Above ₹499)
💰 *TOTAL PAYABLE:* ₹${total}
━━━━━━━━━━━━━━━━━━━━
Please confirm availability and dispatch time. Thank you!`;

        const waUrl = `https://wa.me/917503564364?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    });

    // ===== 15. PRESCRIPTION UPLOAD STUDIO =====
    const rxDropzone = document.getElementById('rxDropzone');
    const rxFileInput = document.getElementById('rxFileInput');
    const rxBrowseBtn = document.getElementById('rxBrowseBtn');
    const dropzoneEmpty = document.getElementById('dropzoneEmpty');
    const dropzonePreview = document.getElementById('dropzonePreview');
    const rxPreviewImg = document.getElementById('rxPreviewImg');
    const rxPdfPlaceholder = document.getElementById('rxPdfPlaceholder');
    const rxPdfName = document.getElementById('rxPdfName');
    const rxRemoveBtn = document.getElementById('rxRemoveBtn');
    const submitRxWhatsAppBtn = document.getElementById('submitRxWhatsAppBtn');

    let uploadedRxFile = null;

    rxBrowseBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        rxFileInput?.click();
    });

    rxDropzone?.addEventListener('click', () => {
        if (!uploadedRxFile) {
            rxFileInput?.click();
        }
    });

    // Drag and Drop
    ['dragenter', 'dragover'].forEach(eventName => {
        rxDropzone?.addEventListener(eventName, (e) => {
            e.preventDefault();
            rxDropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        rxDropzone?.addEventListener(eventName, (e) => {
            e.preventDefault();
            rxDropzone.classList.remove('dragover');
        });
    });

    rxDropzone?.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) handleRxFile(files[0]);
    });

    rxFileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleRxFile(e.target.files[0]);
    });

    function handleRxFile(file) {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            alert('Please select a valid image (JPG, PNG, WEBP) or PDF file.');
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            alert('File size exceeds 15MB. Please choose a smaller file.');
            return;
        }

        uploadedRxFile = file;
        soundFX.playSuccess();

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (rxPreviewImg) rxPreviewImg.src = ev.target.result;
                if (rxPreviewImg) rxPreviewImg.style.display = 'block';
                if (rxPdfPlaceholder) rxPdfPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        } else {
            if (rxPreviewImg) rxPreviewImg.style.display = 'none';
            if (rxPdfPlaceholder) rxPdfPlaceholder.style.display = 'flex';
            if (rxPdfName) rxPdfName.textContent = file.name;
        }

        if (dropzoneEmpty) dropzoneEmpty.style.display = 'none';
        if (dropzonePreview) dropzonePreview.style.display = 'block';
    }

    rxRemoveBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        soundFX.playDelete();
        uploadedRxFile = null;
        if (rxFileInput) rxFileInput.value = '';
        if (dropzoneEmpty) dropzoneEmpty.style.display = 'block';
        if (dropzonePreview) dropzonePreview.style.display = 'none';
    });

    submitRxWhatsAppBtn?.addEventListener('click', () => {
        const pName = document.getElementById('patientName')?.value.trim();
        const pPhone = document.getElementById('patientPhone')?.value.trim();
        const fMode = document.querySelector('input[name="fulfillmentMode"]:checked')?.value || 'Delivery';
        const pAddress = document.getElementById('deliveryAddress')?.value.trim() || 'Shahganj Chowk Pickup';
        const pNotes = document.getElementById('rxNotes')?.value.trim() || 'Standard pack as prescribed';

        if (!pName || !pPhone) {
            alert('Please provide Patient Name and Contact Phone to submit your prescription.');
            return;
        }

        soundFX.playSuccess();

        const fileName = uploadedRxFile ? uploadedRxFile.name : 'Prescription Image ready to attach in chat';

        const message =
`📋 *DOCTOR PRESCRIPTION ORDER — SUGHRA MEDICOSE*
━━━━━━━━━━━━━━━━━━━━
👤 *Patient Name:* ${pName}
📱 *Phone:* ${pPhone}
🛵 *Fulfillment:* ${fMode}
📍 *Address:* ${pAddress}
📝 *Doctor Notes / Needs:* ${pNotes}
📎 *Prescription File:* ${fileName}
━━━━━━━━━━━━━━━━━━━━
👨‍⚕️ *Reviewing Pharmacist:* Tasnim Jamal (7503564364)
Please verify prescription and share final bill & delivery ETA. Thank you!`;

        const waUrl = `https://wa.me/917503564364?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');

        setTimeout(() => {
            alert('You have been directed to WhatsApp (+91 7503564364)!\n\nPlease attach your prescription photo or PDF directly in the chat to complete your order.');
        }, 1200);
    });

    // ===== 16. HEALTH & WELLNESS SUITE CALCULATORS =====
    // Tabs switcher
    const healthTabBtns = document.querySelectorAll('.health-tab-btn');
    const healthPanels = document.querySelectorAll('.health-panel');

    healthTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            soundFX.playClick();
            const tabId = btn.getAttribute('data-tab');
            healthTabBtns.forEach(b => b.classList.remove('active'));
            healthPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabId)?.classList.add('active');
        });
    });

    // TAB 1: BMI CALCULATOR
    const bmiHeight = document.getElementById('bmiHeight');
    const bmiWeight = document.getElementById('bmiWeight');
    const bmiHeightVal = document.getElementById('bmiHeightVal');
    const bmiWeightVal = document.getElementById('bmiWeightVal');
    const bmiScore = document.getElementById('bmiScore');
    const bmiCategory = document.getElementById('bmiCategory');
    const bmiIndicator = document.getElementById('bmiIndicator');
    const bmiAdvice = document.getElementById('bmiAdvice');

    function calculateBMI() {
        if (!bmiHeight || !bmiWeight) return;
        const hCm = parseFloat(bmiHeight.value);
        const wKg = parseFloat(bmiWeight.value);

        if (bmiHeightVal) bmiHeightVal.textContent = `${hCm} cm`;
        if (bmiWeightVal) bmiWeightVal.textContent = `${wKg} kg`;

        const hMeters = hCm / 100;
        const bmi = (wKg / (hMeters * hMeters)).toFixed(1);
        if (bmiScore) bmiScore.textContent = bmi;

        let category = 'Normal Weight';
        let advice = 'Great job! Your BMI is within the healthy recommended range. Keep maintaining a balanced diet and regular exercise.';
        let indicatorPercent = 45;

        if (bmi < 18.5) {
            category = 'Underweight';
            advice = 'Your weight is lower than recommended. Consider nutrient-rich foods, protein supplements, and consult Tasnim Jamal for healthy weight gain advice.';
            indicatorPercent = Math.max(5, (bmi / 18.5) * 25);
        } else if (bmi >= 18.5 && bmi <= 24.9) {
            category = 'Normal Weight';
            indicatorPercent = 25 + ((bmi - 18.5) / 6.4) * 35;
        } else if (bmi >= 25 && bmi <= 29.9) {
            category = 'Overweight';
            advice = 'You are slightly above ideal weight. Regular 30-minute walks, balanced fiber, and lowering sugar intake will help maintain heart health.';
            indicatorPercent = 60 + ((bmi - 25) / 4.9) * 20;
        } else {
            category = 'Obese';
            advice = 'Higher BMI may increase risk of hypertension and diabetes. Regular health checkups, blood sugar monitoring, and doctor guidance are advised.';
            indicatorPercent = Math.min(95, 80 + ((bmi - 30) / 10) * 15);
        }

        if (bmiCategory) bmiCategory.textContent = category;
        if (bmiAdvice) bmiAdvice.textContent = advice;
        if (bmiIndicator) bmiIndicator.style.left = `${indicatorPercent}%`;
    }

    bmiHeight?.addEventListener('input', calculateBMI);
    bmiWeight?.addEventListener('input', calculateBMI);
    calculateBMI();

    // TAB 2: HYDRATION CALCULATOR
    const waterWeight = document.getElementById('waterWeight');
    const waterActivity = document.getElementById('waterActivity');
    const waterWeightVal = document.getElementById('waterWeightVal');
    const waterActivityVal = document.getElementById('waterActivityVal');
    const waterLiters = document.getElementById('waterLiters');
    const waterGlasses = document.getElementById('waterGlasses');

    function calculateWater() {
        if (!waterWeight || !waterActivity) return;
        const weight = parseFloat(waterWeight.value);
        const activity = parseFloat(waterActivity.value);

        if (waterWeightVal) waterWeightVal.textContent = `${weight} kg`;
        if (waterActivityVal) waterActivityVal.textContent = `${activity} mins`;

        // Baseline: 35ml per kg + 350ml per 30 mins exercise
        const baselineMl = weight * 35;
        const activityMl = (activity / 30) * 350;
        const totalLiters = ((baselineMl + activityMl) / 1000).toFixed(1);
        const glasses = Math.round((baselineMl + activityMl) / 250);

        if (waterLiters) waterLiters.textContent = `${totalLiters} L`;
        if (waterGlasses) waterGlasses.textContent = `~${glasses} Glasses / Day (250ml each)`;
    }

    waterWeight?.addEventListener('input', calculateWater);
    waterActivity?.addEventListener('input', calculateWater);
    calculateWater();

    // TAB 4: MEDICATION SCHEDULE BUILDER
    const reminderMedName = document.getElementById('reminderMedName');
    const reminderTiming = document.getElementById('reminderTiming');
    const reminderDays = document.getElementById('reminderDays');
    const addReminderItemBtn = document.getElementById('addReminderItemBtn');
    const medScheduleList = document.getElementById('medScheduleList');
    const exportReminderWhatsAppBtn = document.getElementById('exportReminderWhatsAppBtn');

    let scheduleItems = [];

    addReminderItemBtn?.addEventListener('click', () => {
        const name = reminderMedName?.value.trim();
        const timing = reminderTiming?.value;
        const duration = reminderDays?.value.trim() || 'Ongoing';

        if (!name) {
            alert('Please enter a medicine name and dose.');
            return;
        }

        soundFX.playSuccess();
        scheduleItems.push({ name, timing, duration });
        if (reminderMedName) reminderMedName.value = '';
        if (reminderDays) reminderDays.value = '';
        renderSchedule();
    });

    function renderSchedule() {
        if (!medScheduleList) return;

        if (scheduleItems.length === 0) {
            medScheduleList.innerHTML = `<div class="empty-schedule-msg">No medicines added yet. Fill the form to create your timetable!</div>`;
            if (exportReminderWhatsAppBtn) exportReminderWhatsAppBtn.style.display = 'none';
            return;
        }

        if (exportReminderWhatsAppBtn) exportReminderWhatsAppBtn.style.display = 'block';

        medScheduleList.innerHTML = scheduleItems.map((item, idx) => `
            <div class="schedule-item">
                <div>
                    <strong>💊 ${item.name}</strong>
                    <span>⏰ ${item.timing} • Duration: ${item.duration}</span>
                </div>
                <button class="btn-del-schedule" data-idx="${idx}" title="Delete">
                    <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                </button>
            </div>
        `).join('');

        refreshLucideIcons();

        medScheduleList.querySelectorAll('.btn-del-schedule').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                soundFX.playDelete();
                scheduleItems.splice(idx, 1);
                renderSchedule();
            });
        });
    }

    exportReminderWhatsAppBtn?.addEventListener('click', () => {
        if (scheduleItems.length === 0) return;
        soundFX.playSuccess();

        const timetableText = scheduleItems.map((item, i) => `${i + 1}. *${item.name}*\n   ⏰ Time: ${item.timing}\n   📅 Duration: ${item.duration}`).join('\n\n');

        const message =
`⏰ *MY DAILY MEDICATION TIMETABLE — SUGHRA MEDICOSE*
━━━━━━━━━━━━━━━━━━━━
${timetableText}
━━━━━━━━━━━━━━━━━━━━
🏥 *Pharmacy:* Sughra Medicose (Shahganj Chowk, Ajmeri Gate)
📞 *Pharmacist Hotline:* +91 7503564364 (Tasnim Jamal)`;

        const waUrl = `https://wa.me/917503564364?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    });

    // ===== 17. TESTIMONIALS SLIDER CAROUSEL =====
    const reviewsTrack = document.getElementById('reviewsTrack');
    const reviewCards = reviewsTrack?.querySelectorAll('.testimonial-glass-card');
    const reviewPrevBtn = document.getElementById('reviewPrevBtn');
    const reviewNextBtn = document.getElementById('reviewNextBtn');
    const reviewDotsContainer = document.getElementById('reviewDots');

    let currentReviewSlide = 0;
    let reviewAutoTimer = null;

    if (reviewCards && reviewCards.length > 0) {
        // Create navigation dots
        reviewCards.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = `dot ${i === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => {
                soundFX.playClick();
                goToReview(i);
                resetReviewTimer();
            });
            reviewDotsContainer?.appendChild(dot);
        });

        function goToReview(index) {
            currentReviewSlide = index;
            if (reviewsTrack) {
                reviewsTrack.style.transform = `translateX(-${index * 100}%)`;
            }
            reviewDotsContainer?.querySelectorAll('.dot').forEach((d, i) => {
                d.classList.toggle('active', i === index);
            });
        }

        reviewPrevBtn?.addEventListener('click', () => {
            soundFX.playClick();
            currentReviewSlide = (currentReviewSlide - 1 + reviewCards.length) % reviewCards.length;
            goToReview(currentReviewSlide);
            resetReviewTimer();
        });

        reviewNextBtn?.addEventListener('click', () => {
            soundFX.playClick();
            currentReviewSlide = (currentReviewSlide + 1) % reviewCards.length;
            goToReview(currentReviewSlide);
            resetReviewTimer();
        });

        function startReviewTimer() {
            reviewAutoTimer = setInterval(() => {
                currentReviewSlide = (currentReviewSlide + 1) % reviewCards.length;
                goToReview(currentReviewSlide);
            }, 6000);
        }

        function resetReviewTimer() {
            clearInterval(reviewAutoTimer);
            startReviewTimer();
        }

        startReviewTimer();
    }

    // ===== 18. FAQ ACCORDION =====
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const btn = item.querySelector('.faq-question-btn');
        btn?.addEventListener('click', () => {
            soundFX.playClick();
            const isActive = item.classList.contains('active');
            faqItems.forEach(f => f.classList.remove('active'));
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // ===== 19. 3D CARD TILT EFFECT =====
    const tiltElements = document.querySelectorAll('[data-tilt]');
    tiltElements.forEach(el => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -10;
            const rotateY = ((x - centerX) / centerX) * 10;

            el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
        });

        el.addEventListener('mouseleave', () => {
            el.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)`;
        });
    });

});
