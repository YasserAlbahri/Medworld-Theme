/*
* Medworld Custom Scripts
*/

(function ($) {
    'use strict';

    function sidebar_niceScroll() {
        if (!$.fn.niceScroll) {
            return;
        }
        const scrollSelector = '.side-menu .side-menu-icons > ul, .side-menu .side-menu-items > ul.dropdown-list, .side-menu .side-menu-items > ul.shortcuts-list';
        $(scrollSelector).niceScroll({
            cursorcolor: "rgba(0,0,0,0.35)",
            cursorborder: "0px",
            cursorwidth: "3px",
        });
    }

    // احتفظ بأي خصائص موجودة مسبقاً من Frappe بدلاً من مسحها
    frappe.auth = frappe.auth || {};

    // ترجمة عناوين السايدبار والقائمة المنبثقة
    function translate_menu_labels(allow_retry) {
        // حفظ النصوص المترجمة لتجنب إعادة الترجمة المستمرة
        if (!window.__translated_texts) {
            window.__translated_texts = new Map();
        }
        if (!window.__server_translations) {
            window.__server_translations = {};
        }
        
        const selectors = [
            '.modules-menu .modules-menu-list a',
            '.side-menu-icons.menu-icons-with-label > ul > li > a > span',
            '.side-menu .side-menu-items > ul.dropdown-list > li > a > span',
            '.side-mobile-menu ul.mobile-modules-menu-list > li > a > span',
            '.side-mobile-menu ul.mobile-modules-list > li > a',
            'ul.mobile-modules-list > li > a'
        ];

        let translated = 0;
        const missing_for_server = new Set();
        selectors.forEach(sel => {
            $(sel).each(function () {
                const $el = $(this);
                let baseText = ($el.data('label') || $el.text() || '').toString().trim();
                if (!baseText) return;
                
                // تخطي إذا كان النص بالفعل بالعربية
                if (/[\u0600-\u06FF]/.test(baseText)) return;
                
                // إنشاء معرف فريد للعنصر
                const elementId = $el.attr('data-label') || $el.attr('data-route') || baseText;
                const currentText = $el.text().trim();
                
                // التحقق من أن النص لم يتم ترجمته بالفعل
                if (window.__translated_texts.has(elementId)) {
                    const savedTranslation = window.__translated_texts.get(elementId);
                    // إذا كان النص الحالي هو الترجمة المحفوظة، لا حاجة لإعادة الترجمة
                    if (currentText === savedTranslation) {
                        return;
                    }
                    // إذا كان النص الحالي هو النص الإنجليزي الأصلي، أعد الترجمة
                    if (currentText === baseText && savedTranslation) {
                        $el.text(savedTranslation);
                        const $a = $el.closest('a');
                        if ($a.length) {
                            $a.attr('title', savedTranslation);
                        }
                        translated += 1;
                        return;
                    }
                }

                const localized = __(baseText);
                if (localized && localized.length && localized !== baseText) {
                    $el.text(localized);
                    window.__translated_texts.set(elementId, localized);
                    const $a = $el.closest('a');
                    if ($a.length) {
                        $a.attr('title', localized);
                    }
                    translated += 1;
                    return;
                }

                // محاولة من المخزن القادم من السيرفر
                const fromServer = window.__server_translations[baseText];
                if (fromServer && fromServer !== baseText) {
                    $el.text(fromServer);
                    window.__translated_texts.set(elementId, fromServer);
                    const $a = $el.closest('a');
                    if ($a.length) {
                        $a.attr('title', fromServer);
                    }
                    translated += 1;
                    return;
                }

                missing_for_server.add(baseText);
            });
        });

        // معالجة خاصة لعناصر mobile-modules-list التي قد لا تحتوي على span
        $('ul.mobile-modules-list > li > a').each(function() {
            const $el = $(this);
            let baseText = ($el.data('label') || $el.text() || '').toString().trim();
            if (!baseText) return;
            // تخطي إذا كان النص بالفعل بالعربية (يحتوي على أحرف عربية)
            if (/[\u0600-\u06FF]/.test(baseText)) return;
            
            // إنشاء معرف فريد للعنصر
            const elementId = $el.attr('data-label') || $el.attr('data-route') || baseText;
            const currentText = $el.text().trim();
            
            // التحقق من أن النص لم يتم ترجمته بالفعل
            if (window.__translated_texts.has(elementId)) {
                const savedTranslation = window.__translated_texts.get(elementId);
                // إذا كان النص الحالي هو الترجمة المحفوظة، لا حاجة لإعادة الترجمة
                if (currentText === savedTranslation) {
                    return;
                }
                // إذا كان النص الحالي هو النص الإنجليزي الأصلي، أعد الترجمة
                if (currentText === baseText && savedTranslation) {
                    $el.text(savedTranslation);
                    $el.attr('title', savedTranslation);
                    translated += 1;
                    return;
                }
            }
            
            const localized = __(baseText);
            if (localized && localized.length && localized !== baseText) {
                $el.text(localized);
                window.__translated_texts.set(elementId, localized);
                $el.attr('title', localized);
                translated += 1;
                return;
            }

            const fromServer = window.__server_translations[baseText];
            if (fromServer && fromServer !== baseText) {
                $el.text(fromServer);
                window.__translated_texts.set(elementId, fromServer);
                $el.attr('title', fromServer);
                translated += 1;
                return;
            }

            missing_for_server.add(baseText);
        });

        // إذا بقيت نصوص غير مترجمة ونستطيع جلبها من السيرفر (ملفات اللغة)
        if (missing_for_server.size && !window.__fetching_sidebar_translations) {
            if (window.__server_translations_failed) {
                return;
            }
            window.__fetching_sidebar_translations = true;
            const safeLang =
                (window.frappe &&
                    frappe.boot &&
                    (frappe.boot.lang || (frappe.boot.user && frappe.boot.user.language))) ||
                (window.frappe && frappe.lang) ||
                "ar";
            frappe.call({
                method: "medworld_theme.api.get_label_translations",
                args: {
                    labels: Array.from(missing_for_server),
                    lang: safeLang,
                },
                callback: (r) => {
                    window.__fetching_sidebar_translations = false;
                    if (r && r.message) {
                        Object.assign(window.__server_translations, r.message);
                        // حاول مجدداً بعد جلب الترجمات
                        setTimeout(() => translate_menu_labels(false), 50);
                    }
                },
                error: () => {
                    window.__fetching_sidebar_translations = false;
                    window.__server_translations_failed = true; // لا تحاول مجدداً لتجنب تكرار الأخطاء
                },
            });
        }

        // محاولة ثانية مبكرة إذا لم تتم أي ترجمة (العناصر قد تصل متأخرة)
        if (allow_retry && translated === 0) {
            setTimeout(() => translate_menu_labels(false), 120);
        }
    }


    $(document).ready(function () {

        // navbar search
        // فعّل تمرير السايدبار إذا توفر الملحق
        sidebar_niceScroll();
        
        // تعديل تطبيق Chat ليضيف الأيقونة في navbar المخصص بدلاً من الافتراضي
        if (window.frappe && window.frappe.Chat) {
            const originalChatCreateApp = window.frappe.Chat.prototype.create_app;
            const originalSetupEvents = window.frappe.Chat.prototype.setup_events;
            const repositionChatWindow = () => {
                const $app = $('.chat-app:visible');
                const $icon = $('.dv-navbar .chat-navbar-icon:visible').first();
                if (!$app.length || !$icon.length) return;
                const iconOffset = $icon.offset();
                if (!iconOffset) return;
                const iconHeight = $icon.outerHeight() || 24;
                const iconWidth = $icon.outerWidth() || 24;
                const appWidth = Math.min(420, Math.max($app.outerWidth() || 380, 340));
                const viewportWidth = $(window).width() || 1280;
                const left = Math.min(
                    Math.max(iconOffset.left + (iconWidth / 2) - (appWidth / 2), 8),
                    viewportWidth - appWidth - 8
                );
                const top = iconOffset.top + iconHeight + 6;
                $app.css({
                    position: 'absolute',
                    top: `${top}px`,
                    left: `${left}px`,
                    right: 'auto',
                    bottom: 'auto',
                    width: `${appWidth}px`,
                    'max-width': `${appWidth}px`,
                    padding: '0'
                });
            };

            // ضمان وجود أيقونة واحدة فقط في Navbar المخصص
            const ensureChatIcon = () => {
                const $customNavbar = $('.dv-navbar .dv-nav-right > ul');
                if (!$customNavbar.length) return;
                let $icon = $customNavbar.find('.chat-navbar-icon').first();
                // إذا لم توجد، أنشئها
                if (!$icon.length) {
                    const iconHtml = `
                        <li class="nav-item dropdown dropdown-notifications dropdown-mobile chat-navbar-icon" title="${__("Show Chats")}">
                            ${frappe.utils.icon("small-message", "md")}
                            <span class="badge" id="chat-notification-count"></span>
                        </li>
                    `;
                    $icon = $(iconHtml);
                    const $notifications = $customNavbar.find('.dv-dropdown-notifications').first();
                    if ($notifications.length) {
                        $notifications.before($icon);
                    } else {
                        $customNavbar.prepend($icon);
                    }
                }
                // إزالة أي مكرر آخر
                $customNavbar.find('.chat-navbar-icon').not($icon).remove();
                return $icon;
            };

            if (originalChatCreateApp) {
                window.frappe.Chat.prototype.create_app = function() {
                    // استدعاء الدالة الأصلية
                    originalChatCreateApp.call(this);
                    
                    // نقل الأيقونة من navbar الافتراضي إلى navbar المخصص
                    setTimeout(() => {
                        const $defaultIcon = $('header.navbar .chat-navbar-icon');
                        const $customNavbar = $('.dv-navbar .dv-nav-right > ul');
                        
                        if ($defaultIcon.length && $customNavbar.length) {
                            // نقل الأيقونة إلى navbar المخصص (قبل notifications)
                            const $notifications = $customNavbar.find('.dv-dropdown-notifications').first();
                            if ($notifications.length) {
                                $notifications.before($defaultIcon);
                            } else {
                                $customNavbar.prepend($defaultIcon);
                            }
                            
                            // إزالة الأيقونة من navbar الافتراضي إذا كانت لا تزال موجودة
                            $('header.navbar .chat-navbar-icon').remove();
                        }
                    }, 100);

                    // ضمان عدم وجود تكرارات وإنشاء الأيقونة عند الحاجة
                    setTimeout(ensureChatIcon, 150);
                    setTimeout(repositionChatWindow, 200);
                    // إعادة التعيين إلى أحداث الشات الأصلية لضمان تفعيل الأيقونة
                    if (originalSetupEvents) {
                        window.frappe.Chat.prototype.setup_events = originalSetupEvents;
                    }
                };
            }

            // إعادة تهيئة الدردشة إذا فُقدت الأيقونة بعد إعادة رسم الـ navbar
            const ensureChatReady = () => {
                ensureChatIcon();
                // إذا الأيقونة وواجهة الدردشة موجودة، عدل التموضع واخرج
                if ($(".chat-navbar-icon").length && $(".chat-app").length) {
                    repositionChatWindow();
                    return;
                }
                // لا تنشئ مثيلاً جديداً إذا كان موجوداً بالفعل
                if (frappe.chat && frappe.chat.chat_bubble) return;
                // أنشئ مثيلاً جديداً إن لم يوجد
                try { frappe.chat = new frappe.Chat(); ensureChatIcon(); setTimeout(repositionChatWindow, 120); }
                catch (err) { console.error("Failed to initialize chat", err); }
            };

            // محاولة تهيئة بعد تحميل الواجهة
            setTimeout(ensureChatReady, 800);
            $(document).on("page-change", () => setTimeout(ensureChatReady, 500));
            $(window).on('resize.repositionChat', () => setTimeout(repositionChatWindow, 80));
            // إعادة ربط الأحداث الأصلية والتأكد من التموضع بعد أي نقرة على الأيقونة
            $(document).on("click.medworldReposition", ".chat-navbar-icon", function() {
                setTimeout(repositionChatWindow, 60);
            });
        }

        // ترجم عناوين الووركسبيس/الموديولات بعد اكتمال التحميل أو عند فتح قائمة الموديولات
        $(document).on('dv-app-loaded', function () {
            setTimeout(() => translate_menu_labels(true), 300);
        });
        $(document).on('click', '.btn-open-modules', function () {
            setTimeout(() => translate_menu_labels(true), 200);
        });
        // محاولة مبكرة بعد تحميل الصفحة لترجمة السايدبار مباشرة
        setTimeout(() => translate_menu_labels(true), 500);

        // تحديث نص الـ footer إلى "Powered By Medworld"
        ensure_footer_brand();
        setTimeout(ensure_footer_brand, 500);
        setTimeout(ensure_footer_brand, 1500);
        
        // مراقبة تغييرات الـ footer (للمكونات الديناميكية مثل Vue)
        const footerObserver = new MutationObserver(function() {
            ensure_footer_brand();
        });
        const footerElement = document.getElementById('app-footer');
        if (footerElement) {
            footerObserver.observe(footerElement, { childList: true, subtree: true, characterData: true });
        }

        // مراقبة تغييرات القوائم لإعادة الترجمة عند تغيير النصوص
        let menuTranslationTimeout;
        const menuObserver = new MutationObserver(function(mutations) {
            let shouldTranslate = false;
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    const target = mutation.target;
                    if (target && (
                        target.classList.contains('mobile-modules-list') ||
                        target.classList.contains('mobile-modules-menu-list') ||
                        target.classList.contains('modules-menu-list') ||
                        target.closest('.side-menu') ||
                        target.closest('.side-mobile-menu') ||
                        target.closest('.modules-menu')
                    )) {
                        shouldTranslate = true;
                    }
                }
            });
            if (shouldTranslate) {
                clearTimeout(menuTranslationTimeout);
                menuTranslationTimeout = setTimeout(function() {
                    translate_menu_labels(false);
                }, 100);
            }
        });

        // مراقبة العناصر الرئيسية
        const observeMenus = function() {
            const menus = [
                document.querySelector('.side-menu'),
                document.querySelector('.side-mobile-menu'),
                document.querySelector('.modules-menu'),
                document.querySelector('ul.mobile-modules-list'),
                document.querySelector('ul.mobile-modules-menu-list')
            ];
            menus.forEach(function(menu) {
                if (menu) {
                    menuObserver.observe(menu, { 
                        childList: true, 
                        subtree: true, 
                        characterData: true 
                    });
                }
            });
        };

        // بدء المراقبة بعد تحميل الصفحة
        setTimeout(observeMenus, 500);
        setTimeout(observeMenus, 1500);
        
        // إعادة المراقبة عند تغيير الصفحة
        $(document).on('page-change', function() {
            setTimeout(observeMenus, 200);
            setTimeout(() => translate_menu_labels(false), 300);
        });

        // مراقبة جميع الأحداث التي قد تغير النصوص
        $(document).on('click focus blur change', '.side-menu a, .side-mobile-menu a, .modules-menu a, ul.mobile-modules-list a', function() {
            setTimeout(() => translate_menu_labels(false), 50);
        });

        // مراقبة AJAX completions لإعادة الترجمة بعد تحديثات AJAX
        $(document).ajaxComplete(function() {
            setTimeout(() => translate_menu_labels(false), 100);
        });

        $(this).on('click', '.dv-navbar .open-search', function (event) {
            event.preventDefault();
            $('.dv-navbar .dv-nav-search').fadeIn();
            $('.dv-navbar .dv-nav-search .form-control').trigger('focus');
        });
        $(this).on('click', '.dv-navbar .dv-nav-search .dv-nav-search-close', function (event) {
            event.preventDefault();
            $('.dv-navbar .dv-nav-search').fadeOut();
        });

        $(this).on('click', '.dv-navbar .btn-open-mobile-menu', function (event) {
            event.preventDefault();
            if ($(this).hasClass('show-menu')) {
                $(this).removeClass('show-menu').find('i').addClass('fa-bars').removeClass('fa-times');
                $('.side-menu').hide();
                $('.side-mobile-menu').hide();
            } else {
                $(this).addClass('show-menu').find('i').removeClass('fa-bars').addClass('fa-times');
                $('.side-menu').show();
                $('.side-mobile-menu').show();
                // ترجمة عناصر قائمة الموبايل عند فتحها
                setTimeout(() => translate_menu_labels(true), 100);
            }
        });
        // $(this).on('focus', '.dv-navbar .dv-nav-search .form-control', function (event) {
        //     $('.dv-app-theme').addClass('show-overlay');
        // }).on('blur', '.dv-navbar .dv-nav-search .form-control', function (event) {
        //     $('.dv-app-theme').removeClass('show-overlay');
        // });

        $(this).on("page-change", function () {
            $('.dv-app-theme').removeClass('show-overlay');
            // $('.dv-navbar .dv-nav-search').fadeOut();
            // $('.dv-navbar .dv-nav-search .form-control').trigger('blur');
        });

        // tooltip
        $('[data-toggle="tooltip"]').tooltip({boundary: 'window'});
        $('[data-toggle="tipsy"]').tipsy({fade: true, gravity: 'w'});

        // تأكد أن الروابط تذهب لسلَج صحيح في وضع Page
        $(document).on('click.dvSlugFix', '.side-menu .side-menu-icons > ul > li > a, .modules-menu .modules-menu-list a, .side-mobile-menu a', function (event) {
            const mode = ($('body').data('menu-opening-type') || '').toString().toLowerCase();
            if (mode !== 'page') {
                return;
            }
            const raw = $(this).data('route') || $(this).data('label') || $(this).attr('href') || $(this).text();
            const slug = slugify_workspace(raw);
            if (!slug) {
                return;
            }
            event.preventDefault();
            if (frappe && frappe.set_route) {
                frappe.set_route('workspace', slug, 'pagem');
            } else {
                window.location.href = `/app/workspace/${slug}/pagem`;
            }
        });

        // side menu
        $(this).on('click', '.side-menu .side-menu-icons > ul > li > a', function (event) {
            $(this).parents('ul').find('>li').removeClass('active');
            $(this).parent().addClass('active');
            // إعادة الترجمة بعد النقر
            setTimeout(() => translate_menu_labels(false), 100);
        })
        // files icon
        $(this).on('click', '.dv-navbar .files-icon', function (event) {
            event.preventDefault();
            frappe.set_route("List", "File");
        });
        // files icon
        $(this).on('click', '.dv-navbar .full-screen-icon', function (event) {
            event.preventDefault();
            if (!$.fullscreen || !$.fullscreen.isFullScreen) {
                return;
            }

            const isFullScreen = $.fullscreen.isFullScreen();
            if (isFullScreen) {
                $.fullscreen.exit();
                $('i', this).removeClass('fa-compress').addClass('fa-expand');
            } else {
                $('body').fullscreen();
                $('i', this).removeClass('fa-expand').addClass('fa-compress');
            }
        });

        $(document).off('shown.bs.dropdown', '.dv-navbar .dropdown-user');

        // إصلاح مشكلة فتح قائمة Help
        function fix_help_dropdown() {
            // إغلاق القائمة افتراضياً
            $('.dv-navbar .dropdown-help .dropdown-menu').removeClass('show');
            $('.dv-navbar .dropdown-help').removeClass('show');
            
            $('.dv-navbar .dropdown-help > a, .dv-navbar .dropdown-help .dropdown-lang-link').each(function() {
                const $link = $(this);
                // إزالة onclick="return false;" إذا كان موجوداً
                if ($link.attr('onclick') === 'return false;' || $link.attr('onclick') === 'return false') {
                    $link.removeAttr('onclick');
                }
                // إضافة data-toggle="dropdown" إذا لم يكن موجوداً
                if (!$link.attr('data-toggle')) {
                    $link.attr('data-toggle', 'dropdown');
                }
            });
            
            // تهيئة Bootstrap dropdown للـ Help
            if ($.fn.dropdown) {
                $('.dv-navbar .dropdown-help > a, .dv-navbar .dropdown-help .dropdown-lang-link').dropdown();
            }
        }

        // إغلاق قائمة Help افتراضياً عند تحميل الصفحة
        setTimeout(function() {
            $('.dv-navbar .dropdown-help .dropdown-menu').removeClass('show').css('display', 'none');
            $('.dv-navbar .dropdown-help').removeClass('show');
        }, 100);
        
        // إصلاح قائمة Help عند تحميل الصفحة
        fix_help_dropdown();
        setTimeout(fix_help_dropdown, 500);
        setTimeout(fix_help_dropdown, 1500);

        // إصلاح قائمة Help عند تحميل التطبيق
        $(document).on('app-loaded', function() {
            // إغلاق القائمة افتراضياً
            setTimeout(function() {
                $('.dv-navbar .dropdown-help .dropdown-menu').removeClass('show').css('display', 'none');
                $('.dv-navbar .dropdown-help').removeClass('show');
            }, 50);
            
            setTimeout(fix_help_dropdown, 300);
            
            // إصلاح CSS لقائمة Help بعد تحميل التطبيق
            setTimeout(function() {
                const $helpMenu = $('#toolbar-help');
                if ($helpMenu.length) {
                    // إغلاق القائمة افتراضياً
                    $helpMenu.removeClass('show').css('display', 'none');
                    $helpMenu.closest('.dropdown-help').removeClass('show');
                    
                    // إظهار documentation-links دائماً حتى لو لم تكن هناك help links
                    const $docLinks = $helpMenu.find('.documentation-links');
                    if ($docLinks.length) {
                        $docLinks.show().css({
                            'display': 'block !important',
                            'visibility': 'visible !important',
                            'opacity': '1 !important'
                        });
                    }
                    
                    // التأكد من أن عناصر help_dropdown مرئية
                    $helpMenu.find('.dropdown-item').each(function() {
                        const $item = $(this);
                        // إظهار العنصر إذا كان يحتوي على نص أو رابط أو action
                        if ($item.text().trim() || $item.attr('href') || $item.attr('onclick')) {
                            $item.show().css({
                                'display': 'block !important',
                                'visibility': 'visible !important',
                                'opacity': '1 !important',
                                'height': 'auto !important',
                                'min-height': 'auto !important'
                            });
                        }
                    });
                }
            }, 500);
        });

        // إصلاح مشكلة إخفاء documentation-links في Frappe
        $(document).on('page-change', function() {
            // إغلاق القائمة عند تغيير الصفحة
            $('.dv-navbar .dropdown-help .dropdown-menu').removeClass('show').css('display', 'none');
            $('.dv-navbar .dropdown-help').removeClass('show');
            
            setTimeout(function() {
                const $helpMenu = $('#toolbar-help');
                if ($helpMenu.length) {
                    // إظهار documentation-links دائماً (إجبار) - حتى لو كان Frappe يخفيها
                    const $docLinks = $helpMenu.find('.documentation-links');
                    if ($docLinks.length) {
                        $docLinks.show().css({
                            'display': 'block !important',
                            'visibility': 'visible !important',
                            'opacity': '1 !important',
                            'height': 'auto !important'
                        });
                    }
                    
                    // إظهار جميع عناصر help_dropdown
                    $helpMenu.find('.dropdown-item').each(function() {
                        const $item = $(this);
                        // تخطي العناصر الفارغة أو التي لا تحتوي على نص
                        if ($item.text().trim() || $item.attr('href') || $item.attr('onclick')) {
                            $item.show().css({
                                'display': 'block !important',
                                'visibility': 'visible !important',
                                'opacity': '1 !important',
                                'height': 'auto !important',
                                'min-height': 'auto !important'
                            });
                        }
                    });
                    
                    // إظهار dividers
                    $helpMenu.find('.dropdown-divider').css({
                        'display': 'block !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important',
                        'height': '1px !important',
                        'min-height': '1px !important'
                    });
                }
            }, 100);
        });

        // مراقبة تغييرات قائمة Help وإصلاحها تلقائياً
        const helpMenuObserver = new MutationObserver(function(mutations) {
            const $helpMenu = $('#toolbar-help');
            if ($helpMenu.length) {
                // إظهار documentation-links دائماً
                const $docLinks = $helpMenu.find('.documentation-links');
                if ($docLinks.length && $docLinks.is(':hidden')) {
                    $docLinks.show().css({
                        'display': 'block !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important'
                    });
                }
                
                // التأكد من أن عناصر help_dropdown مرئية
                $helpMenu.find('.dropdown-item').each(function() {
                    const $item = $(this);
                    if ($item.text().trim() && $item.is(':hidden')) {
                        $item.show().css({
                            'display': 'block !important',
                            'visibility': 'visible !important',
                            'opacity': '1 !important'
                        });
                    }
                });
                
                // التأكد من أن القائمة مرئية عند فتحها فقط
                if ($helpMenu.hasClass('show')) {
                    $helpMenu.css({
                        'display': 'block !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important',
                        'z-index': '1050 !important'
                    });
                } else {
                    // إغلاق القائمة إذا لم تكن مفتوحة
                    $helpMenu.css({
                        'display': 'none !important'
                    });
                }
            }
        });

        // بدء مراقبة قائمة Help
        setTimeout(function() {
            const $helpMenu = $('#toolbar-help');
            if ($helpMenu.length) {
                helpMenuObserver.observe($helpMenu[0], {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });
                
                // إجبار إظهار عناصر help_dropdown عند تحميل الصفحة
                const $docLinks = $helpMenu.find('.documentation-links');
                if ($docLinks.length) {
                    $docLinks.show().css({
                        'display': 'block !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important'
                    });
                }
                
                // إظهار جميع عناصر help_dropdown
                $helpMenu.find('.dropdown-item').each(function() {
                    const $item = $(this);
                    if ($item.text().trim() || $item.attr('href') || $item.attr('onclick')) {
                        $item.show().css({
                            'display': 'block !important',
                            'visibility': 'visible !important',
                            'opacity': '1 !important'
                        });
                    }
                });
            }
        }, 1000);

        // معالجة النقر على زر Help يدوياً إذا لم يعمل Bootstrap dropdown
        $(document).on('click', '.dv-navbar .dropdown-help > a, .dv-navbar .dropdown-help .dropdown-lang-link', function(event) {
            const $link = $(this);
            const $dropdown = $link.closest('.dropdown-help');
            const $menu = $dropdown.find('.dropdown-menu');
            
            // إذا كان onclick="return false;" موجود، تعامل معه يدوياً
            if ($link.attr('onclick') && $link.attr('onclick').includes('return false')) {
                event.preventDefault();
                event.stopPropagation();
                
                // تبديل حالة القائمة
                if ($menu.hasClass('show')) {
                    // إغلاق القائمة
                    $menu.removeClass('show');
                    $dropdown.removeClass('show');
                    $menu.css('display', 'none');
                } else {
                    // إغلاق جميع القوائم الأخرى
                    $('.dv-navbar .dropdown-menu.show').removeClass('show');
                    $('.dv-navbar .dropdown.show').removeClass('show');
                    $('.dv-navbar .dropdown-menu.show').css('display', 'none');
                    
                    // فتح قائمة Help
                    $menu.addClass('show');
                    $dropdown.addClass('show');
                    
                    // إصلاح CSS لضمان ظهور القائمة
                    $menu.css({
                        'display': 'block !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important',
                        'z-index': '1050 !important',
                        'min-height': 'auto !important',
                        'max-height': 'none !important',
                        'overflow': 'visible !important',
                        'position': 'absolute !important'
                    });
                    
                    // إظهار documentation-links دائماً
                    const $docLinks = $menu.find('.documentation-links');
                    if ($docLinks.length) {
                        $docLinks.show().css({
                            'display': 'block !important',
                            'visibility': 'visible !important',
                            'opacity': '1 !important'
                        });
                    }
                    
                    // التأكد من أن عناصر help_dropdown مرئية
                    $menu.find('.dropdown-item').each(function() {
                        const $item = $(this);
                        if ($item.text().trim()) {
                            $item.css({
                                'display': 'block !important',
                                'visibility': 'visible !important',
                                'opacity': '1 !important',
                                'height': 'auto !important',
                                'min-height': 'auto !important'
                            });
                        }
                    });
                }
            }
        });

        // إغلاق قائمة Help عند النقر خارجها
        $(document).on('click', function(event) {
            if (!$(event.target).closest('.dropdown-help').length) {
                const $helpMenu = $('.dv-navbar .dropdown-help .dropdown-menu');
                $helpMenu.removeClass('show');
                $helpMenu.css('display', 'none');
                $('.dv-navbar .dropdown-help').removeClass('show');
            }
        });

        // change language according to data-language of dropdown item
        $(this).on("click", "#header-navbar-change-lang .dropdown-item", function (event) {
            event.preventDefault();
            let $this = $(this);
            // $this.siblings(".selected").removeClass("selected");
            let language = $this.data('lang');
            let selected_flag = $this.find(".dv-lang-flag").attr("class");
            $("#header-navbar-change-lang .dropdown-lang-link").html(`<span class="${selected_flag}"></span> ${language}`);
            frappe.call({
                method: "medworld_theme.api.change_language",
                args: {
                    language: language.toLowerCase()
                },
                callback: function (r) {
                    localStorage.setItem("active_lang", language);
                    frappe.ui.toolbar.clear_cache();
                }
            });
        });

        $(this).on('click', '.side-menu .side-menu-items > ul.dropdown-list > li > a, .side-menu ul.mobile-modules-menu-list > li > a', function () {
            if ($(this).parent().hasClass('active')) {
                if (!$(this).parent().hasClass('hide-sub-menu')) {
                    $(this).parent().addClass('hide-sub-menu');
                    $(this).parent().find('>ul').slideUp();
                } else {
                    $(this).parent().removeClass('hide-sub-menu');
                    $(this).parent().find('>ul').slideDown();
                }
            } else {
                $('.side-menu .side-menu-items > ul.dropdown-list > li, .side-menu ul.mobile-modules-menu-list > li').removeClass('hide-sub-menu active').find('>ul').slideUp();
                $(this).parent().removeClass('hide-sub-menu').addClass('active');
                $(this).parent().find('>ul').slideDown();
            }
            setTimeout(() => {
                const $lists = $('.side-menu .side-menu-items > ul.dropdown-list, .side-menu .side-menu-items > ul.shortcuts-list');
                if ($lists.getNiceScroll) {
                    $lists.getNiceScroll().resize();
                } else if ($.fn.niceScroll) {
                    sidebar_niceScroll();
                }
                // إعادة الترجمة بعد فتح/إغلاق القوائم
                translate_menu_labels(false);
            }, 500);
        });

        $(this).on('mouseover', '.animated-tada', function () {
            $('.animated-icon', this).addClass('animated tada');
        }).on('mouseout', '.animated-tada', function () {
            $('.animated-icon', this).removeClass('animated tada');
        });

        $(this).on('mouseover', '.btn-toggle-main-menu', function () {
            let is_menu_shown = $(this).hasClass('menu-shown');
            if (is_menu_shown) {
                $('>i.far', this).removeClass('fa-bars fa-chevron-double-right').addClass('fa-chevron-double-left');
            } else {
                $('>i.far', this).removeClass('fa-bars fa-chevron-double-left').addClass('fa-chevron-double-right');
            }
        }).on('mouseout', '.btn-toggle-main-menu', function () {
            $('>i.far', this).removeClass('fa-chevron-double-left fa-chevron-double-right').addClass('fa-bars');
        });

        $(this).on('click', '.btn-toggle-main-menu', function () {
            let is_menu_shown = $(this).hasClass('menu-shown');
            if (is_menu_shown) {
                $(this).removeClass('menu-shown');
                $('body').addClass('hide-main-menu');
            } else {
                $(this).addClass('menu-shown');
                $('body').removeClass('hide-main-menu');
            }
        });


        $(this).on('click', '.btn-open-modules', function () {
            if ($(this).hasClass('active')) {
                $(this).removeClass('active').find('i').removeClass().addClass('flaticon-menu');
                $('.modules-menu').fadeOut();
            } else {
                $(this).addClass('active').find('i').removeClass().addClass('fal fa-times');
                translate_menu_labels(false);
                $('.modules-menu').toggle(300);
            }
        });

    });

    $(document).on("page-change", function () {
        $('.btn-open-modules').removeClass('active').find('i').removeClass().addClass('flaticon-menu');
        $('.modules-menu').fadeOut();
        if (window.innerWidth <= 820) {
            $('.dv-navbar .dv-nav-search').hide();
            $('.dv-navbar .btn-open-mobile-menu').removeClass('show-menu').find('i').addClass('fa-bars').removeClass('fa-times');
            $('.side-menu').hide();
            $('.side-mobile-menu').hide();
        }

        // تأكد من سلوك وضع Page فقط (لا تعيد التوجيه للروابط الفرعية)
        const $content = $('.dv-app-content');
        const route = (frappe && frappe.get_route) ? frappe.get_route() : [];
        const routeMissing = !route || !route.length || !(route[0] || '').length;
        const isWorkspaceRoute = is_page_workspace_route(route);
        const pageMode = is_page_mode();
        const forcedPrehide = !!window.__dv_prehide_forced;

        // عند عدم توفر route بعد (ريفرش قوي)، لا تفرّغ المحتوى وانتظر إعادة الفحص
        if ((pageMode || forcedPrehide) && routeMissing) {
            setTimeout(enforce_blank_page_mode, 120);
            return;
        }

        if (forcedPrehide && !isWorkspaceRoute) {
            window.__dv_prehide_forced = false;
            teardown_page_mode($content);
            return;
        }

        if ((pageMode || forcedPrehide) && (isWorkspaceRoute || forcedPrehide)) {
            window.__dv_page_mode_active = true;
            // أبقِ الحجب الاحتياطي إذا كنا غير متأكدين من الـroute (forcedPrehide)
            if (isWorkspaceRoute) {
                window.__dv_prehide_forced = false;
            }
            show_page_mode_landing($content);
            $('body, html').removeClass('dv-prehide');
            clear_prehide_visibility();
        } else {
            // أي تنقل آخر يعيد المحتوى الطبيعي ويغلق طبقة الخلفية
            teardown_page_mode($content);
            window.__dv_page_mode_active = false;
            window.__dv_page_mode_target = '';
        }
        setTimeout(() => translate_menu_labels(true), 80);
        ensure_footer_brand();
        
        // إعادة الترجمة بعد أي تفاعل مع القوائم
        setTimeout(() => translate_menu_labels(false), 300);
    });

    $(document).on("app-loaded", function () {

        if (frappe.is_app_loaded)
            return;

        hide_quick_actions_for_non_admin();
        
        // إعادة بناء قائمة اللغات بناءً على اللغات المفعلة
        function rebuild_language_dropdown() {
            console.log('[Language Dropdown] Starting rebuild_language_dropdown...');
            frappe.call({
                method: "medworld_theme.api.get_enabled_languages",
                args: {},
                callback: function (response) {
                    console.log('[Language Dropdown] API Response:', response);
                    if (response && response.message && Array.isArray(response.message)) {
                        const enabledLanguages = response.message;
                        console.log('[Language Dropdown] Enabled languages:', enabledLanguages);
                        const enabledCodes = enabledLanguages.map(function(lang) {
                            return lang.code.toUpperCase();
                        });
                        console.log('[Language Dropdown] Enabled codes:', enabledCodes);
                        
                        const $dropdownMenu = $('#header-navbar-change-lang .dropdown-menu');
                        if (!$dropdownMenu.length) {
                            console.warn('[Language Dropdown] Dropdown menu not found!');
                            return;
                        }
                        console.log('[Language Dropdown] Dropdown menu found, current items:', $dropdownMenu.find('.dropdown-item').length);
                        
                        // مسح القائمة الحالية (ما عدا EO إذا كان موجوداً)
                        let removedCount = 0;
                        $dropdownMenu.find('.dropdown-item').each(function() {
                            const $item = $(this);
                            const langCode = ($item.data('lang') || '').toUpperCase();
                            if (langCode !== 'EO') {
                                console.log('[Language Dropdown] Removing item:', langCode);
                                $item.remove();
                                removedCount++;
                            }
                        });
                        console.log('[Language Dropdown] Removed', removedCount, 'items');
                        
                        // إضافة اللغات المفعلة
                        const hideIcon = $('body').data('hide-language-icon') == 1;
                        let addedCount = 0;
                        enabledLanguages.forEach(function(lang) {
                            const langCode = (lang.code || '').toUpperCase();
                            if (!langCode) {
                                console.warn('[Language Dropdown] Skipping language with no code:', lang);
                                return;
                            }
                            const langLabel = lang.label || langCode;
                            const flagClass = lang.flag || 'dv-lang-flag lang-en';
                            
                            // التحقق من عدم وجود العنصر مسبقاً
                            if (!$dropdownMenu.find('.dropdown-item[data-lang="' + langCode + '"]').length) {
                                let itemHtml = '';
                                if (!hideIcon) {
                                    itemHtml = '<span class="' + flagClass + '"></span> ';
                                }
                                itemHtml += langLabel;
                                
                                const $newItem = $('<a>', {
                                    'class': 'dropdown-item',
                                    'data-lang': langCode,
                                    'html': itemHtml
                                });
                                
                                console.log('[Language Dropdown] Adding language:', langCode, langLabel);
                                
                                // إضافة قبل EO إذا كان موجوداً، وإلا أضفه في النهاية
                                const $eoItem = $dropdownMenu.find('.dropdown-item[data-lang="EO"]');
                                if ($eoItem.length) {
                                    $eoItem.before($newItem);
                                } else {
                                    $dropdownMenu.append($newItem);
                                }
                                addedCount++;
                            } else {
                                console.log('[Language Dropdown] Language already exists:', langCode);
                            }
                        });
                        console.log('[Language Dropdown] Added', addedCount, 'languages. Total items now:', $dropdownMenu.find('.dropdown-item').length);
                    } else {
                        console.error('[Language Dropdown] Invalid response format:', response);
                    }
                },
                error: function(r) {
                    console.error('[Language Dropdown] API Error:', r);
                }
            });
        }
        
        // استدعاء الدالة بعد تحميل الصفحة
        setTimeout(rebuild_language_dropdown, 500);
        setTimeout(rebuild_language_dropdown, 1500);

        // حضّر قائمة الووركسبيس مبكراً
        prime_workspace_slugs();

        setup_menu_opening_page();

        // تأكيد تطبيق وضع Page على أول تحميل بعد تسجيل الدخول
        enforce_blank_page_mode();
        setTimeout(enforce_blank_page_mode, 250);
        // فرض التحويل إلى أول ووركسبيس متاحة، وتجاهل أي كاش سابق
        enforce_default_workspace_route();
        setTimeout(() => translate_menu_labels(true), 180);

        let AppLogoVM = new Vue({
            el: '#medworld-app-logo',
            delimiters: ["[[", "]]"],
            data: {
                logo_path: '',
                logo_class: '',
                user: {},
            },
            methods: {
                get_company_logo: function () {
                    const $this = this;
                    const logo = '/files/logo with slogan.png';
                    frappe.call({
                        type: 'POST',
                        method: 'medworld_theme.api.get_company_logo',
                        args: {},
                        callback: async function (response) {
                            if (response.message && response.message.length) {
                                $this.logo_path = response.message;
                                $this.logo_class = 'has-company-logo';
                            } else {
                                $this.logo_class = '';
                                $this.logo_path = logo;
                            }
                        }
                    });
                }
            },
            async mounted() {
                const logo = '/files/logo with slogan.png';
                if (frappe.theme_settings && frappe.theme_settings.theme_logo && frappe.theme_settings.theme_logo.length) {
                    this.logo_path = frappe.theme_settings.theme_logo;
                    this.logo_class = 'has-company-logo';
                } else {
                    this.logo_class = '';
                    this.logo_path = logo;
                }
                this.get_company_logo();
            },
            created: function () {
                this.user = frappe.get_cookies();
            }
        });

        new Vue({
            el: '#header-navbar-user',
            delimiters: ["[[", "]]"],
            data: {
                user: {},
                user_type: ''
            },
            created: function () {
                this.user = frappe.get_cookies();
                frappe.db.get_value('User', this.user.user_id, 'user_type', (response) => {
                    if (this.user.user_id == 'Administrator') {
                        this.user_type = __('Administrator');
                    } else {
                        this.user_type = (response.user_type) ? __(response.user_type) : __('User');
                    }
                    frappe.auth['user'] = this.user;
                    frappe.auth['user'].user_type = this.user_type;
                    frappe.auth['user'].user_roles = frappe.user_roles;
                });
            }
        });

        new Vue({
            el: '#header-navbar-change-lang',
            delimiters: ["[[", "]]"],
            data: {
                hide_language_icon: $('body').data('hide-language-icon'),
                lang_list: {},
                enabled_languages: [],
                active_lang: 'EN'
            },
            methods: {
                get_current_language: function () {
                    const $this = this;
                    frappe.call({
                        method: "medworld_theme.api.get_current_language",
                        args: {},
                        callback: function (response) {
                            if (response && response.message && response.message) {
                                $this.active_lang = (response.message).toUpperCase();
                            } else {
                                $this.active_lang = localStorage.getItem("active_lang") || 'EN';
                            }
                        }
                    });
                },
                get_enabled_languages: function () {
                    const $this = this;
                    console.log('[Vue Language Component] get_enabled_languages called');
                    frappe.call({
                        method: "medworld_theme.api.get_enabled_languages",
                        args: {},
                        callback: function (response) {
                            console.log('[Vue Language Component] API Response:', response);
                            if (response && response.message && Array.isArray(response.message)) {
                                $this.enabled_languages = response.message;
                                console.log('[Vue Language Component] Enabled languages set:', $this.enabled_languages);
                                
                                // بناء lang_list للتوافق مع الكود القديم
                                const langListObj = {};
                                response.message.forEach(function(lang) {
                                    langListObj[lang.code] = {
                                        label: lang.label,
                                        flag: lang.flag,
                                        name: lang.name
                                    };
                                });
                                $this.lang_list = langListObj;
                                console.log('[Vue Language Component] lang_list built:', $this.lang_list);
                                
                                // إعادة بناء القائمة بعد تحديث البيانات
                                setTimeout(function() {
                                    console.log('[Vue Language Component] Calling hide_disabled_languages');
                                    $this.hide_disabled_languages();
                                }, 100);
                            } else {
                                console.error('[Vue Language Component] Invalid response format:', response);
                            }
                        },
                        error: function(r) {
                            console.error('[Vue Language Component] Error fetching enabled languages:', r);
                        }
                    });
                },
                hide_disabled_languages: function () {
                    const $this = this;
                    console.log('[Vue Language Component] hide_disabled_languages called');
                    console.log('[Vue Language Component] enabled_languages:', $this.enabled_languages);
                    const enabledCodes = $this.enabled_languages.map(function(lang) {
                        return (lang.code || '').toUpperCase();
                    });
                    console.log('[Vue Language Component] Enabled codes:', enabledCodes);
                    
                    // إعادة بناء قائمة اللغات ديناميكياً
                    const $dropdownMenu = $('#header-navbar-change-lang .dropdown-menu');
                    if (!$dropdownMenu.length) {
                        console.warn('[Vue Language Component] Language dropdown menu not found');
                        return;
                    }
                    console.log('[Vue Language Component] Dropdown menu found, current items:', $dropdownMenu.find('.dropdown-item').length);
                    
                    if ($this.enabled_languages.length > 0) {
                        // مسح القائمة الحالية وإعادة بنائها بناءً على اللغات المفعلة فقط
                        console.log('[Vue Language Component] Clearing dropdown menu');
                        $dropdownMenu.empty();
                        
                        // إضافة اللغات المفعلة
                        const hideIcon = $this.hide_language_icon == 1;
                        let addedCount = 0;
                        $this.enabled_languages.forEach(function(lang) {
                            const langCode = (lang.code || '').toUpperCase();
                            const langLabel = lang.label || langCode;
                            const flagClass = lang.flag || 'dv-lang-flag lang-en';
                            
                            let itemHtml = '';
                            if (!hideIcon) {
                                itemHtml = '<span class="' + flagClass + '"></span> ';
                            }
                            itemHtml += langLabel;
                            
                            const $newItem = $('<a>', {
                                'class': 'dropdown-item',
                                'data-lang': langCode,
                                'html': itemHtml
                            });
                            
                            console.log('[Vue Language Component] Adding language:', langCode, langLabel);
                            $dropdownMenu.append($newItem);
                            addedCount++;
                        });
                        console.log('[Vue Language Component] Added', addedCount, 'languages. Total items now:', $dropdownMenu.find('.dropdown-item').length);
                    } else {
                        // إذا لم تكن هناك لغات مفعلة، أخفِ العناصر غير المفعلة فقط
                        $('#header-navbar-change-lang .dropdown-menu .dropdown-item').each(function() {
                            const $item = $(this);
                            const langCode = ($item.data('lang') || '').toUpperCase();
                            
                            // إذا كانت اللغة غير موجودة في قائمة اللغات المفعلة، أخفها
                            if (langCode && !enabledCodes.includes(langCode)) {
                                $item.hide();
                            } else if (langCode && enabledCodes.includes(langCode)) {
                                $item.show();
                            }
                        });
                    }
                }
            },
            created: function () {
                this.get_current_language();
            },
            mounted: function () {
                const $this = this;
                console.log('[Vue Language Component] Component mounted');
                // جلب اللغات المفعلة بعد تحميل العنصر
                setTimeout(function() {
                    console.log('[Vue Language Component] Calling get_enabled_languages after mount');
                    $this.get_enabled_languages();
                }, 300);
            }
        });


        // list-sidebar .sidebar-section
        $(document).on('click', '.list-sidebar .sidebar-section > li.sidebar-label, .form-sidebar > .sidebar-menu > li.sidebar-label', function () {
            let parent = $(this).parent();
            parent.toggleClass('hide-content');
        });

        setup_workspace_save_sync();

        // تحديث نص الـ footer بعد تحميل التطبيق
        ensure_footer_brand();
        setTimeout(ensure_footer_brand, 500);
        setTimeout(ensure_footer_brand, 1500);

    });

    $(document).on("page-change", function () {
        hide_quick_actions_for_non_admin();
        const route = (frappe && frappe.get_route) ? frappe.get_route() : [];
        const onPageSuffix = route_has_page_suffix(route) || route_has_page_suffix(get_initial_route_string());
        if (is_page_mode() && onPageSuffix) {
            window.__dv_page_mode_active = true;
            show_page_mode_landing($('.dv-app-content'));
        } else if (!is_page_mode()) {
            window.__dv_page_mode_active = false;
            relax_blank_page_mode($('.dv-app-content'));
        }
        // تأكد من ترجمة السايدبار بعد أي تنقل
        setTimeout(() => translate_menu_labels(true), 200);
        ensure_footer_brand();
        
        // إعادة الترجمة بعد أي تفاعل مع القوائم
        setTimeout(() => translate_menu_labels(false), 400);
    });

    function setup_menu_opening_page() {
        const $content = $('.dv-app-content');
        if (!$content.length) {
            return;
        }

        if (!$content.data('dv-menu-opening-page-initialized')) {
            $content.data('dv-menu-opening-page-initialized', true);
            inject_menu_opening_page_styles();
        }

        // عند الضغط على عناصر السايدبار الرئيسية أو عناصر modules menu (أيقونات/ووركسبيس)، فعّل صفحة الخلفية
        // استهدف أيقونات السايدبار الجانبية فقط (الجذرية) وروابط modules-menu
        $(document).off('click.dvPageMode').on('click.dvPageMode', '.side-menu .side-menu-icons > ul > li > a, .side-mobile-menu a, .modules-menu .modules-menu-list a', function (event) {
            if (!is_page_mode()) {
                relax_blank_page_mode($content);
                window.__dv_page_mode_active = false;
                return;
            }

            const isModulesMenuLink = $(this).closest('.modules-menu').length > 0;
            const isTopSidebar = is_top_level_sidebar_link(this);

            if (!isModulesMenuLink && !isTopSidebar) {
                // ليست عنصرًا رئيسيًا في السايدبار ولا modules menu؛ اتركها تعمل بشكل طبيعي
                return;
            }

            const target = extract_workspace_target(this);
            const isWorkspace = is_workspace_target(target) || (!get_workspace_slugs().size && isTopSidebar);
            const slug = target.slug;

            if (isWorkspace) {
                event.preventDefault();
                window.__dv_page_mode_active = true;
                window.__dv_page_mode_target = slug || '';
                show_page_mode_landing($content);

                navigate_to_target_if_needed(target);
                return false;
            }

            // روابط السايدبار الجذرية يفترض أن تكون ووركسبيس؛ إن لم نتعرف عليها، فعّل الخلفية واترك التوجيه الافتراضي
            if (isTopSidebar) {
                window.__dv_page_mode_active = true;
                window.__dv_page_mode_target = '';
                show_page_mode_landing($content);
                // لا نمنع التوجيه هنا ليكمل الـhref الافتراضي (قد يكون Doctype)
            }
        });

        // حافظ على تناسق الحالة الأولية
        if (!is_page_mode()) {
            relax_blank_page_mode($content);
            window.__dv_page_mode_active = false;
        } else if (is_page_route()) {
            window.__dv_page_mode_active = true;
            show_page_mode_landing($content);
        }
    }

    function inject_menu_opening_page_styles() {
        if ($('#dv-menu-opening-page-style').length) {
            return;
        }

        const css = `
            .dv-app-content.dv-menu-opening-page {
                position: relative;
                overflow: hidden;
                min-height: 100vh;
                background: transparent;
            }
            .dv-menu-opening-landing {
                position: absolute;
                inset: 0;
                background-image: url("/files/pagem.jpeg");
                background-size: contain;
                background-position: center;
                background-repeat: no-repeat;
                min-height: 100vh;
                z-index: 2;
            }
            .dv-menu-opening-landing__layer {
                position: absolute;
                inset: 0;
                /* background: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.2) 100%); */
                z-index: 3;
            }
            .dv-app-content.dv-menu-opening-page #body,
            .dv-app-content.dv-menu-opening-page #app-footer {
                display: none !important;
            }
            body.dv-page-route,
            html.dv-page-route {
                background-image: url("/files/pagem.jpeg");
                background-size: contain;
                background-position: center;
                background-repeat: no-repeat;
                min-height: 100vh;
            }
            body.dv-hide-desk-content .page-container,
            body.dv-hide-desk-content .layout-main,
            body.dv-hide-desk-content .layout-main-section,
            body.dv-hide-desk-content .layout-main-section-wrapper,
            body.dv-hide-desk-content .page-head,
            body.dv-hide-desk-content .layout-side-section,
            body.dv-hide-desk-content .page-content,
            body.dv-hide-desk-content .page-main-content,
            body.dv-hide-desk-content .page-content-wrapper {
                display: none !important;
            }
        `;

        $('<style id="dv-menu-opening-page-style" type="text/css"></style>')
            .text(css)
            .appendTo('head');
    }

    function ensure_landing_layer($content) {
        if ($('#dv-menu-opening-landing').length) {
            return;
        }
        const landing = $(`
            <div id="dv-menu-opening-landing" class="dv-menu-opening-landing">
                <div class="dv-menu-opening-landing__layer"></div>
            </div>
        `);
        $content.addClass('dv-menu-opening-page').prepend(landing);
    }

    function set_prehide_visibility() {
        // أخفِ أي محتوى مبكراً لتجنب وميض الووركسبيس قبل تفعيل طبقة الصفحة
        document.documentElement.style.visibility = 'hidden';
        if (document.body) {
            document.body.style.visibility = 'hidden';
        }
    }

    function clear_prehide_visibility() {
        document.documentElement.style.removeProperty('visibility');
        document.body.style.removeProperty('visibility');
    }

    // حارس مبكر يمنع وميض محتوى الـWorkspace بعد ريفرش قوي في وضع Page
    // يبدأ بالحجب فقط إذا كان المسار يحمل suffix pagem
    (function early_prehide_workspace_on_load() {
        try {
            if (!is_page_mode()) {
                return;
            }
            const initialRoute = get_initial_route_string();
            if (!route_has_page_suffix(initialRoute)) {
                return;
            }

            // احقن الستايل لضمان إخفاء المحتوى فوراً
            inject_prehide_styles();
            inject_menu_opening_page_styles();
            set_prehide_visibility();

            const applyLanding = function () {
                const $content = $('.dv-app-content');
                if (!$content.length) {
                    // إذا لم تُنشأ بعد، أعد المحاولة سريعاً
                    setTimeout(applyLanding, 30);
                    return;
                }
                ensure_landing_layer($content);
                $content.addClass('dv-menu-opening-page');
                $('#dv-menu-opening-landing').show();
            };

            applyLanding();
            $('body, html').addClass('dv-hide-desk-content dv-page-route dv-prehide');

            // حمّل قائمة الووركسبيس مباشرة لتقليل الاعتماد على التخمين
            fetch_workspace_slugs_now(true);
        } catch (e) {
            /* ignore */
        }
    })();

    function enforce_blank_page_mode() {
        const $content = $('.dv-app-content');
        const pageMode = is_page_mode();
        const forcedPrehide = !!window.__dv_prehide_forced;

        // إذا لم يكن وضع Page مفعلاً ولا يوجد حجب احتياطي، أخرج
        if (!pageMode && !forcedPrehide) {
            teardown_page_mode($content);
            return;
        }

        // إذا لم يُنشأ المحتوى بعد، أبقِ الحجب وحاول لاحقاً
        if (!$content.length) {
            $('body, html').addClass('dv-prehide dv-hide-desk-content dv-page-route');
            setTimeout(enforce_blank_page_mode, 60);
            return;
        }

        const route = (frappe && frappe.get_route) ? frappe.get_route() : [];
        const routeMissing = !route || !route.length || !(route[0] || '').length;

        const hasPageSuffix = route_has_page_suffix(route) || route_has_page_suffix(get_initial_route_string());

        // في وضع Page + suffix pagem فقط نفعل الحجب
        if (pageMode && hasPageSuffix) {
            if (!__dv_workspace_ready && !__dv_workspace_fetching) {
                fetch_workspace_slugs_now();
            }
            window.__dv_page_mode_active = true;
            show_page_mode_landing($content);
            $('body, html').removeClass('dv-prehide');
            clear_prehide_visibility();
        } else if (!pageMode && routeMissing) {
            // ابقِ الخلفية مفعّلة حتى يتوفر المسار بعد التحميل الأول/الريفرش
            window.__dv_page_mode_active = true;
            show_page_mode_landing($content);
            setTimeout(enforce_blank_page_mode, 120);
            return;
        } else if (!pageMode && (window.__dv_page_mode_active || forcedPrehide || is_page_workspace_route())) {
            window.__dv_page_mode_active = true;
            if (is_page_workspace_route()) {
                window.__dv_prehide_forced = false;
            }
            show_page_mode_landing($content);
            $('body, html').removeClass('dv-prehide');
            clear_prehide_visibility();
        } else {
            teardown_page_mode($content);
        }

        if (routeMissing) {
            // ابقِ الخلفية مفعّلة حتى يتوفر المسار بعد التحميل الأول/الريفرش
            window.__dv_page_mode_active = true;
            show_page_mode_landing($content);
            setTimeout(enforce_blank_page_mode, 120);
            return;
        }

        if (window.__dv_page_mode_active || forcedPrehide || is_page_workspace_route()) {
            window.__dv_page_mode_active = true;
            if (is_page_workspace_route()) {
                window.__dv_prehide_forced = false;
            }
            show_page_mode_landing($content);
            $('body, html').removeClass('dv-prehide');
            clear_prehide_visibility();
        } else {
            teardown_page_mode($content);
        }

        setup_body_observer();
    }

    function setup_body_observer() {
        if (window.__dv_page_mode_observer) {
            return;
        }
        const target = document.body;
        if (!target) {
            return;
        }
        window.__dv_page_mode_observer = new MutationObserver(function () {
            if (!is_page_mode()) {
                teardown_body_observer();
                return;
            }
            if (window.__dv_page_mode_active && is_page_workspace_route()) {
                // لا تفرغ المحتوى؛ اترك فربّه يدير الصفحات، واكتفِ بالخلفية
                ensure_landing_layer($('.dv-app-content'));
            }
        });
        window.__dv_page_mode_observer.observe(target, { childList: true, subtree: true });
    }

    function teardown_body_observer() {
        if (window.__dv_page_mode_observer) {
            window.__dv_page_mode_observer.disconnect();
            window.__dv_page_mode_observer = null;
        }
    }

    function relax_blank_page_mode($content) {
        if (!$content || !$content.length) {
            return;
        }
        $('body').removeClass('dv-hide-desk-content dv-prehide');
        $content.removeClass('dv-menu-opening-page');
        $('#dv-menu-opening-landing').hide();
        $('#app-footer').show();
    }

    function teardown_page_mode($content) {
        if (!$content || !$content.length) {
            return;
        }
        window.__dv_page_mode_active = false;
        $('body, html').removeClass('dv-hide-desk-content dv-page-route dv-prehide');
        clear_prehide_visibility();
        $content.removeClass('dv-menu-opening-page');
        $('#dv-menu-opening-landing').hide();
        $('#app-footer').show();
    }

    // تحديث نص "Powered By" إلى "Powered By Medworld"
    function ensure_footer_brand() {
        const $footer = $('#app-footer .app-footer, footer#app-footer .app-footer, .app-footer');
        if ($footer.length) {
            $footer.each(function() {
                const $el = $(this);
                const currentText = $el.text().trim();
                if (currentText === 'Powered By' || currentText === 'Powered by') {
                    $el.text('Powered By Medworld');
                }
            });
        }
    }

    function is_page_mode() {
        const raw = ($('body').data('menu-opening-type') || $('body').attr('data-menu-opening-type') || '');
        return raw.toString().toLowerCase() === 'page';
    }

    function is_page_workspace_route(routeArr) {
        const route = Array.isArray(routeArr)
            ? routeArr
            : (frappe && frappe.get_route ? frappe.get_route() : []);
        if (!route || !route.length) return false;
        return route_has_page_suffix(route) || route_points_to_workspace(route.join('/'));
    }

    // يتحقق هل المسار الحالي هو صفحة ووركسبيس الخاصة بوضع Page
    function is_page_route() {
        return is_page_workspace_route();
    }

    function hide_quick_actions_for_non_admin() {
        try {
            const user = (frappe.session && frappe.session.user) || '';
            const is_admin = user && user.toLowerCase() === 'administrator';

            if (is_admin) {
                $('body, html').addClass('dv-admin-quick-actions');
            } else {
                $('body, html').removeClass('dv-admin-quick-actions');
            }
        } catch (e) {
            /* ignore */
        }
    }

    function is_top_level_sidebar_link(el) {
        const $li = $(el).closest('li');
        if (!$li.length) return false;
        const $ul = $li.parent();
        if (!$ul.length) return false;

        // جذور الأيقونات أو قوائم الووركسبيس الرئيسية فقط
        const isIconsRoot = $ul.is('.side-menu-icons > ul');
        const isDropdownRoot = $ul.is('.side-menu-items > ul.dropdown-list') && !$li.parents('li').length;
        const isMobileRoot = $ul.is('.side-mobile-menu ul.mobile-modules-menu-list');

        return isIconsRoot || isDropdownRoot || isMobileRoot;
    }

    // Helpers لتحديد روابط الـ Workspace بدقة
    const __dv_workspace_slugs = new Set();

    let __dv_workspace_ready = false;
    let __dv_workspace_fetching = false;
    let __dv_first_workspace_slug = '';

    // أسماء تعتبر دائماً Workspace حتى لو لم ترد في boot أو قائمة السيرفر
    const __dv_default_workspace_names = new Set(['home']);

    // إخفاء مبكر جداً لتجنب وميض محتوى الووركسبيس عند التحميل/الهارد ريلود
    early_pre_hide();

    function early_pre_hide() {
        try {
            const pageModeEnabled = is_page_mode();
            const bodyMode = ($('body').data('menu-opening-type') || '').toString().toLowerCase() === 'page';
            const routeStr = get_initial_route_string();
            const looksLikeWorkspace = routeStr && route_points_to_workspace(routeStr);

            // لا نفعّل الحجب إلا إذا كان المسار يبدو Workspace أو ليس لدينا مسار بعد مع تفعيل وضع Page
            if (!looksLikeWorkspace && !(pageModeEnabled && !routeStr)) {
                return;
            }

            // وضع Page أو مسار يشبه Workspace => فعّل حجباً احتياطياً
            window.__dv_prehide_forced = true;

            inject_prehide_styles();
            inject_menu_opening_page_styles();
            set_prehide_visibility();
            // أضف الحجب على html فوراً، ثم على body حالما يصبح متاحاً
            const htmlEl = document.documentElement;
            htmlEl.classList.add('dv-prehide', 'dv-hide-desk-content', 'dv-page-route');
            const addToBody = () => {
                const bodyEl = document.body;
                if (!bodyEl) {
                    requestAnimationFrame(addToBody);
                    return;
                }
                bodyEl.classList.add('dv-prehide', 'dv-hide-desk-content', 'dv-page-route');
            };
            addToBody();

            // حمّل قائمة الووركسبيس فوراً لتقليل الاعتماد على التخمين
            fetch_workspace_slugs_now(true);
        } catch (e) {
            /* ignore */
        }
    }

    // يحinject ستايل مبكر لإخفاء محتوى الديسك عند الحاجة (dv-prehide)
    function inject_prehide_styles() {
        if (document.getElementById('dv-prehide-style')) {
            return;
        }
        const css = `
            body.dv-prehide #body,
            body.dv-prehide .page-head,
            body.dv-prehide .layout-main,
            body.dv-prehide .layout-main-section,
            body.dv-prehide .layout-main-section-wrapper,
            body.dv-prehide .page-content,
            body.dv-prehide .page-main-content,
            body.dv-prehide .page-content-wrapper,
            body.dv-prehide .layout-side-section,
            html.dv-prehide #body,
            html.dv-prehide .page-head,
            html.dv-prehide .layout-main,
            html.dv-prehide .layout-main-section,
            html.dv-prehide .layout-main-section-wrapper,
            html.dv-prehide .page-content,
            html.dv-prehide .page-main-content,
            html.dv-prehide .page-content-wrapper,
            html.dv-prehide .layout-side-section {
                display: none !important;
            }
        `;
        const styleEl = document.createElement('style');
        styleEl.id = 'dv-prehide-style';
        styleEl.type = 'text/css';
        styleEl.appendChild(document.createTextNode(css));
        document.head.appendChild(styleEl);
    }

    function safe_decode_route(routeStr) {
        const raw = (routeStr || '').toString();
        try {
            return decodeURIComponent(raw);
        } catch (e) {
            return raw;
        }
    }

    function strip_route_prefix(routeStr) {
        const route = safe_decode_route(routeStr).trim();
        return route
            .replace(/^#/, '')
            .replace(/^\/+/, '')
            .replace(/^app\//i, '')
            .trim();
    }

    function to_workspace_slug(val) {
        if (!val) return '';
        return safe_decode_route(val)
            .toString()
            .trim()
            .replace(/^#/, '')
            .replace(/^\/+/, '')
            .replace(/^app\//i, '')
            .replace(/[_\s]+/g, '-')
            .replace(/[^a-zA-Z0-9-]+/g, '-')
            .replace(/--+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
    }

    function slugify_workspace(val) {
        return to_workspace_slug(val);
    }

    function build_workspace_slugs() {
        if (__dv_workspace_ready && __dv_workspace_slugs.size) return __dv_workspace_slugs;

        const boot = (window.frappe && frappe.boot) || {};
        const pools = [];
        if (Array.isArray(boot.allowed_workspaces)) pools.push(...boot.allowed_workspaces);
        if (Array.isArray(boot.workspaces)) pools.push(...boot.workspaces);

        pools.forEach(ws => add_workspace_candidates(ws));
        if (!__dv_first_workspace_slug) {
            const first = get_first_workspace_slug_from_list(pools);
            if (first) {
                __dv_first_workspace_slug = first;
            }
        }

        __dv_workspace_ready = true;
        return __dv_workspace_slugs;
    }

    function fetch_workspace_slugs_now(force = false) {
        if (__dv_workspace_fetching && !force) {
            return;
        }
        if (!window.frappe || !frappe.call) {
            return;
        }
        __dv_workspace_fetching = true;
        frappe.call({
            method: 'frappe.desk.desktop.get_workspace_sidebar_items',
            args: {},
            callback: function (r) {
                __dv_workspace_fetching = false;
                const message = (r && r.message) || {};
                const sections = []
                    .concat(message.modules || [])
                    .concat(message.pages || [])
                    .concat(message.dashboards || []);
                sections.forEach(section => {
                    if (!section) return;
                    if (Array.isArray(section.items)) {
                        section.items.forEach(add_workspace_candidates);
                    } else {
                        add_workspace_candidates(section);
                    }
                });
                __dv_workspace_ready = true;
                // بعد تحميل القائمة، أعد فرض حالة Page لضمان بقاء الحجب إذا لزم
                setTimeout(enforce_blank_page_mode, 20);
            },
            error: function () {
                __dv_workspace_fetching = false;
            }
        });
    }

    function add_workspace_candidates(ws) {
        if (!ws) return;
        const candidates = [];
        if (typeof ws === 'string') {
            candidates.push(ws);
        } else {
            candidates.push(ws.route, ws.name, ws.title, ws.label);
            if (ws.link_to) candidates.push(ws.link_to);
        }
        candidates
            .filter(Boolean)
            .forEach(c => {
                const parts = normalize_route(c);
                const slug = parts.length ? to_workspace_slug(parts[0]) : '';
                if (slug) {
                    __dv_workspace_slugs.add(slug);
                }
            });
    }

    function normalize_route(routeStr) {
        const cleaned = strip_route_prefix(routeStr);
        if (!cleaned) {
            return [];
        }
        const parts = cleaned.split('/').map(part => part.trim());
        if (!parts.length) {
            return [];
        }
        // تجاهل لاحقة pagem إن وُجدت
        if (parts.length && parts[parts.length - 1].toLowerCase() === 'pagem') {
            parts.pop();
        }
        // طبّق الـ slugify على أول جزء لضمان تطابق مسارات الووركسبيس
        parts[0] = to_workspace_slug(parts[0]) || parts[0];
        return parts;
    }

    function route_has_page_suffix(routeArrOrStr) {
        if (Array.isArray(routeArrOrStr)) {
            if (!routeArrOrStr.length) return false;
            const last = (routeArrOrStr[routeArrOrStr.length - 1] || '').toString().toLowerCase();
            return last === 'pagem';
        }
        const str = (routeArrOrStr || '').toString().toLowerCase();
        return /(^|\/)pagem(\/|$)/.test(str);
    }

    // يعيد تمثيلاً نصياً للمسار الحالي مبكراً (hash أو pathname)
    function get_initial_route_string() {
        const hash = (window.location && window.location.hash || '').replace(/^#/, '').trim();
        const path = (window.location && window.location.pathname || '').replace(/^\/+/, '').trim();
        // إذا كان الـhash يبدأ بـ app/ استخدمه، وإلا استخدم الـpathname
        if (hash && hash.toLowerCase().startsWith('app/')) {
            return hash;
        }
        return hash || path;
    }

    function get_first_workspace_slug() {
        const boot = (window.frappe && frappe.boot) || {};
        const pools = [];
        if (Array.isArray(boot.allowed_workspaces) && boot.allowed_workspaces.length) {
            pools.push(...boot.allowed_workspaces);
        } else if (Array.isArray(boot.workspaces)) {
            pools.push(...boot.workspaces);
        }

        for (let i = 0; i < pools.length; i++) {
            const ws = pools[i];
            const slug = get_first_workspace_slug_from_item(ws);
            if (slug) return slug;
        }
        return '';
    }

    function get_first_workspace_slug_from_item(ws) {
        if (!ws) return '';
        const candidates = [];
        if (typeof ws === 'string') {
            candidates.push(ws);
        } else {
            candidates.push(ws.route, ws.name, ws.title, ws.label);
            if (ws.link_to) candidates.push(ws.link_to);
        }
        for (let j = 0; j < candidates.length; j++) {
            const parts = normalize_route(candidates[j]);
            if (parts.length) {
                const slug = to_workspace_slug(parts[0]);
                if (slug) {
                    return slug;
                }
            }
        }
        return '';
    }

    function get_first_workspace_slug_from_list(list) {
        if (!Array.isArray(list)) return '';
        for (let i = 0; i < list.length; i++) {
            const slug = get_first_workspace_slug_from_item(list[i]);
            if (slug) return slug;
        }
        return '';
    }

    function fetch_first_workspace_slug(callback) {
        if (!window.frappe || !frappe.call) {
            return;
        }
        if (__dv_workspace_fetching) {
            return;
        }
        __dv_workspace_fetching = true;
        frappe.call({
            method: 'frappe.desk.desktop.get_workspace_sidebar_items',
            args: {},
            callback: function (r) {
                __dv_workspace_fetching = false;
                const message = (r && r.message) || {};
                const pages = message.pages || message.modules || [];
                const slug = get_first_workspace_slug_from_list(pages);
                if (slug) {
                    __dv_first_workspace_slug = slug;
                }
                if (typeof callback === 'function') {
                    callback(slug);
                }
            },
            error: function () {
                __dv_workspace_fetching = false;
            }
        });
    }

    // حاول جلب قائمة الووركسبيس من السيرفر إذا لم تتوفر في boot
    function prime_workspace_slugs() {
        build_workspace_slugs();
        if (__dv_workspace_fetching || __dv_workspace_slugs.size) {
            return;
        }
        if (!window.frappe || !frappe.call) {
            return;
        }
        __dv_workspace_fetching = true;
        frappe.call({
            method: 'frappe.desk.desktop.get_workspace_sidebar_items',
            args: {},
            callback: function (r) {
                __dv_workspace_fetching = false;
                const message = (r && r.message) || {};
                const sections = []
                    .concat(message.modules || [])
                    .concat(message.pages || [])
                    .concat(message.dashboards || []);
                sections.forEach(section => {
                    if (!section) return;
                    if (Array.isArray(section.items)) {
                        section.items.forEach(add_workspace_candidates);
                    } else {
                        add_workspace_candidates(section);
                    }
                });
            },
            error: function () {
                __dv_workspace_fetching = false;
            }
        });
    }

    function route_points_to_workspace(routeStr) {
        const parts = normalize_route(routeStr);
        if (!parts.length) return false;

        const first = to_workspace_slug(parts[0]);
        const second = to_workspace_slug(parts[1] || '');

        if (__dv_default_workspace_names.has(first)) {
            return true;
        }

        if (is_non_workspace_prefix(first)) {
            return false;
        }

        const slugs = get_workspace_slugs();
        if (!slugs.size) {
            // fallback أكثر تحفظاً: اعتبره Workspace إذا كان وضع Page مفعلاً وليس من البوادئ المستبعدة
            if (is_page_mode() && !is_non_workspace_prefix(first)) {
                return true;
            }
            return __dv_default_workspace_names.has(first) || (first === 'workspace' && !!second);
        }
        if (first === 'workspace' && second && slugs.has(second)) {
            return true;
        }

        return slugs.has(first);
    }

    function is_workspace_target(target) {
        if (!target || !target.slug) return false;
        // المسار الطبيعي (مع قائمة الووركسبيس)
        if (route_points_to_workspace(target.slug)) return true;
        // لو المسار يحمل prefix workspace صريح
        if (target.hasWorkspacePrefix) return true;
        return false;
    }

    function slugify_label(str) {
        if (!str) return '';
        return str.toString();
    }

    function extract_workspace_target(el) {
        const empty = { slug: '', routeParts: [], hasWorkspacePrefix: false };
        if (!el) return empty;
        const $el = $(el);
        const routeAttr = $el.data('route') || $el.attr('href') || '';
        if (routeAttr) {
            const raw = routeAttr.toString();
            const hasWorkspacePrefix = /^#?\s*\/?\s*(app\/)?workspace\//i.test(raw);
            const parts = normalize_route(raw);
            const slug = to_workspace_slug(parts[0] || '');
            const routeParts = hasWorkspacePrefix ? ['workspace', slug].concat(parts.slice(1)) : [slug].concat(parts.slice(1));
            return { slug, routeParts, hasWorkspacePrefix };
        }

        // fallback فقط إذا لم يوجد route/href
        const textCandidate = ($el.text() || '').toString();
        const parts = normalize_route(textCandidate);
        const slug = to_workspace_slug(parts[0] || '');
        return { slug, routeParts: [slug].concat(parts.slice(1)), hasWorkspacePrefix: /^workspace\//i.test(textCandidate) };
    }

    function navigate_to_target_if_needed(target) {
        if (!target || !target.slug) return;
        const routeParts = target.routeParts || [];
        if (!routeParts.length || !routeParts[0]) return;

        const current = (frappe && frappe.get_route) ? frappe.get_route() : [];
        const currentNorm = normalize_route((current || []).join('/'));
        const targetNorm = normalize_route(routeParts.join('/'));
        const arraysEqual = (a, b) => {
            if (!Array.isArray(a) || !Array.isArray(b)) return false;
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return false;
            }
            return true;
        };

        if (arraysEqual(currentNorm, targetNorm)) {
            return;
        }

        // في وضع Page أضف suffix pagem لضمان بقاء صفحة الخلفية
        let finalRouteParts = routeParts.slice();
        if (is_page_mode() && target.slug) {
            // إذا لم يكن آخر جزء pagem، أضفه
            const last = (finalRouteParts[finalRouteParts.length - 1] || '').toString().toLowerCase();
            if (last !== 'pagem') {
                finalRouteParts = ['workspace', target.slug, PAGE_SUFFIX];
            }
        }

        if (frappe && frappe.set_route) {
            frappe.set_route.apply(null, finalRouteParts);
        } else {
            const path = '/app/' + finalRouteParts.join('/');
            window.location.href = path;
        }
    }

    function get_workspace_slugs() {
        prime_workspace_slugs();
        return build_workspace_slugs();
    }

    function is_non_workspace_prefix(first) {
        const nonWorkspacePrefixes = ['doctype', 'report', 'query-report', 'page', 'list', 'form'];
        return nonWorkspacePrefixes.includes(first);
    }

    // يفرض التحويل إلى أول ووركسبيس متاحة ويتجاهل أي كاش مسار سابق
    function enforce_default_workspace_route() {
        if (window.__dv_default_ws_forced) {
            return;
        }
        const slug = get_first_workspace_slug();
        if (!slug && __dv_first_workspace_slug) {
            // استخدم slug المحسوب من قائمة السيرفر
            return attempt_redirect(__dv_first_workspace_slug);
        }
        if (!slug) {
            // حاول جلب أول ووركسبيس متاحة من السيرفر ثم أعد المحاولة
            fetch_first_workspace_slug(function (s) {
                if (s) {
                    setTimeout(enforce_default_workspace_route, 50);
                }
            });
            return;
        }
        const currentRoute = (frappe && frappe.get_route) ? frappe.get_route() : [];
        const route = Array.isArray(currentRoute) ? currentRoute : [];
        const first = (route[0] || '').toString().toLowerCase();
        const second = (route[1] || '').toString().toLowerCase();

        const alreadyOnDefault =
            (first === 'workspace' && second === slug) ||
            (first === slug && route.length === 1);

        // إذا لم يكن المكتب جاهزاً أو الراوت غير متاح، أعد المحاولة لاحقاً
        if (!route.length || !frappe.route_history) {
            window.__dv_default_ws_forced = false;
            setTimeout(enforce_default_workspace_route, 250);
            return;
        }

        if (alreadyOnDefault) {
            window.__dv_default_ws_forced = true;
            return;
        }

        window.__dv_default_ws_forced = true;
        // لا تقم بالتوجيه إذا كان النظام في وضع الضيف/بدون جلسة
        if (!frappe || !frappe.session || !frappe.session.user || frappe.session.user === 'Guest') {
            return;
        }

        // لا تقم بالتوجيه إذا لم يتم تحميل المكتب/الـdesk بالكامل
        if (!frappe.boot || !frappe.boot.desk_page) {
            window.__dv_default_ws_forced = false;
            setTimeout(enforce_default_workspace_route, 250);
            return;
        }

        // قم بالتوجيه بأمان
        try {
            attempt_redirect(slug);
        } catch (e) {
            // إذا فشل التوجيه (مثلاً route null) أعد المحاولة بعد قليل
            window.__dv_default_ws_forced = false;
            setTimeout(enforce_default_workspace_route, 250);
        }
    }

    function goto_workspace_page(wsName) {
        if (!wsName) return;
        if (window.__dv_page_route_pending) {
            return;
        }
        window.__dv_page_route_pending = true;
        if (frappe && frappe.set_route) {
            frappe.set_route('workspace', wsName, PAGE_SUFFIX);
        } else {
            window.location.href = `/app/workspace/${wsName}/${PAGE_SUFFIX}`;
        }
        setTimeout(() => {
            window.__dv_page_route_pending = false;
        }, 500);
    }

    function attempt_redirect(slug) {
        if (!slug) return;
        if (frappe && frappe.set_route) {
            frappe.set_route('workspace', slug);
        } else {
            window.location.href = `/app/workspace/${slug}`;
        }
        setTimeout(enforce_blank_page_mode, 120);
    }

    const PAGE_SUFFIX = 'pagem';

    function show_page_mode_landing($content) {
        ensure_landing_layer($content);
        $content.addClass('dv-menu-opening-page');
        $('#dv-menu-opening-landing').show();
        $('body, html').addClass('dv-hide-desk-content dv-page-route');
        window.__dv_page_mode_active = true;
        $('#app-footer').hide();
        clear_prehide_visibility();
    }

    function setup_workspace_save_sync() {
        if (window.__dv_workspace_sync_hooked) {
            return;
        }
        window.__dv_workspace_sync_hooked = true;

        $(document).ajaxComplete(function (event, xhr, settings) {
            if (!settings || !settings.url || settings.url.indexOf('frappe.desk.doctype.workspace.workspace.save_page') === -1) {
                return;
            }

            const payload = get_ajax_payload(settings.data);
            const args = parse_workspace_request_args(payload);

            if (!args || !args.blocks) {
                return;
            }

            let blocks;
            try {
                blocks = JSON.parse(args.blocks);
            } catch (error) {
                return;
            }

            const card_order = (blocks || [])
                .filter(block => block.type === 'card' && block.data && block.data.card_name)
                .map(block => block.data.card_name);

            if (!card_order.length) {
                return;
            }

            frappe.call({
                method: 'medworld_theme.api.sync_workspace_cards',
                args: {
                    title: args.title || '',
                    is_public: (function (val) {
                        const str = (val === undefined || val === null) ? '' : String(val).trim().toLowerCase();
                        return (str === '1' || str === 'true') ? 1 : 0;
                    })(args.public),
                    card_order: card_order
                }
            });
        });
    }

    function get_ajax_payload(data) {
        if (!data) {
            return null;
        }

        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch (error) {
                try {
                    const parsed = {};
                    const params = new URLSearchParams(data);
                    params.forEach(function (value, key) {
                        parsed[key] = value;
                    });
                    return parsed;
                } catch (e) {
                    return null;
                }
            }
        }

        return data;
    }

    function parse_workspace_request_args(payload) {
        if (!payload) {
            return null;
        }

        if (payload.args) {
            try {
                return JSON.parse(payload.args);
            } catch (e) {
                /* ignore */
            }
        }

        if (payload.kwargs) {
            try {
                return JSON.parse(payload.kwargs);
            } catch (error) {
                /* ignore */
            }
        }

        return payload;
    }

})(jQuery);
