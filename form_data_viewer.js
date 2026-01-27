/*
 * This file is based on user_form.js but heavily modified to
 * work as a data viewer for the admin panel.
 *
 * Key Changes:
 * 1. Removed password/login view.
 * 2. Fetches data directly using ID and Type from URL.
 * 3. Uses admin API endpoints (travelers.php, dependents.php) instead of public_api.php.
 * 4. Normalizes the flat data from admin API into the { personal, questions } structure.
 * 5. Loads directly into the Summary View.
 * 6. Added functional, server-updating Lock/Unlock button.
 * 7. Added click-to-copy functionality for summary fields.
 * 8. Secured page with session check.
 * 9. Removed all edit functionality and UI.
 * 10. Updated header as requested.
 */

// --- Global Helper Functions (Outside jQuery ready) ---

// Helper to convert snake_case to camelCase (for API requests)
function snakeToCamelCase(str) {
    return str.replace(/_([a-z0-9])/g, (match, letter) => letter.toUpperCase());
}

$(document).ready(function () {
    const urlParams = new URLSearchParams(window.location.search);
    // Admin panel provides ID and Type
    const recordId = urlParams.get('id');
    const recordType = urlParams.get('type');

    // Make accessible to edit module
    window.recordId = recordId;
    window.recordType = recordType;

    console.log('=== PAGE LOADED ===');
    console.log('URL:', window.location.href);
    console.log('recordId from URL:', recordId, '(type:', typeof recordId, ')');
    console.log('recordType from URL:', recordType);

    let recordData = {
        personal: {},
        questions: {}
    };
    window.recordData = recordData;
    console.log(recordData);
    let isFormLocked = false;
    window.isFormLocked = isFormLocked; // Make accessible to edit module


    // --- Configuration (Copied from user_form.js) ---
    const editablePersonalFields = ['contact_number', 'email', 'address_line_1', 'address_line_2', 'city', 'state_province', 'zip_code', 'country'];
    const mandatoryPersonalFields = ['contact_number', 'email', 'address_line_1', 'city', 'state_province', 'zip_code'];
    const countries = ["Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo, Democratic Republic of the", "Congo, Republic of the", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (Burma)", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"];
    const destinations = [{ country: '🇦🇹 Austria', cities: ['Vienna', 'Salzburg', 'Graz', 'Linz', 'Innsbruck'] }, { country: '🇧🇪 Belgium', cities: ['Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Liège'] }, { country: '🇧🇬 Bulgaria', cities: ['Sofia', 'Plovdiv', 'Varna', 'Burgas', 'Ruse'] }, { country: '🇭🇷 Croatia', cities: ['Zagreb', 'Split', 'Dubrovnik', 'Rijeka', 'Osijek'] }, { country: '🇨🇿 Czech Republic', cities: ['Prague', 'Brno', 'Ostrava', 'Plzeň', 'Liberec'] }, { country: '🇩🇰 Denmark', cities: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg'] }, { country: '🇪🇪 Estonia', cities: ['Tallinn', 'Tartu', 'Narva', 'Pärnu', 'Kohtla-Järve'] }, { country: '🇫🇮 Finland', cities: ['Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Oulu'] }, { country: '🇫🇷 France', cities: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice'] }, { country: '🇩🇪 Germany', cities: ['Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt'] }, { country: '🇬🇷 Greece', cities: ['Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Larissa'] }, { country: '🇭🇺 Hungary', cities: ['Budapest', 'Debrecen', 'Szeged', 'Miskolc', 'Pécs'] }, { country: '🇮🇸 Iceland', cities: ['Reykjavík', 'Akureyri', 'Reykjanesbær', 'Kopavogur', 'Hafnarfjordur'] }, { country: '🇮🇹 Italy', cities: ['Rome', 'Milan', 'Naples', 'Turin', 'Florence'] }, { country: '🇱🇻 Latvia', cities: ['Riga', 'Jurmala', 'Liepaja', 'Jelgava'] }, { country: '🇱🇮 Liechtenstein', cities: ['Vaduz', 'Balzers', 'Eschen', 'Schaan'] }, { country: '🇱🇹 Lithuania', cities: ['Vilnius', 'Kaunas', 'Klaipeda', 'Šiauliai', 'Panevėžys'] }, { country: '🇱🇺 Luxembourg', cities: ['Luxembourg City', 'Ettelbruck', 'Differdange', 'Dudelange'] }, { country: '🇲🇹 Malta', cities: ['Valletta', 'Mosta', 'Mellieħa', 'Sliema', 'Birkirkara'] }, { country: '🇳🇱 Netherlands', cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'] }, { country: '🇳🇴 Norway', cities: ['Oslo', 'Bergen', 'Stavanger', 'Trondheim', 'Drammen'] }, { country: '🇵🇱 Poland', cities: ['Warsaw', 'Kraków', 'Gdańsk', 'Wrocław', 'Poznań'] }, { country: '🇵🇹 Portugal', cities: ['Lisbon', 'Porto', 'Braga', 'Coimbra', 'Aveiro'] }, { country: '🇷🇴 Romania', cities: ['Bucharest', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța'] }, { country: '🇸🇰 Slovakia', cities: ['Bratislava', 'Košice', 'Prešov', 'Nitra', 'Žilina'] }, { country: '🇸🇮 Slovenia', cities: ['Ljubljana', 'Maribor', 'Celje', 'Kranj', 'Koper'] }, { country: '🇪🇸 Spain', cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao'] }, { country: '🇸🇪 Sweden', cities: ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås'] }, { country: '🇨🇭 Switzerland', cities: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne'] }];

    let currentView = '#summary-view'; // Start at summary

    const buildStructuredAddressFields = (prefix) => [
        { id: `${prefix}_address_1`, placeholder: 'Address Line 1 *', type: 'text' },
        { id: `${prefix}_address_2`, placeholder: 'Address Line 2', type: 'text' },
        { id: `${prefix}_city`, placeholder: 'City *', type: 'text' },
        { id: `${prefix}_state`, placeholder: 'State/Province *', type: 'text' },
        { id: `${prefix}_zip`, placeholder: 'Postal Code *', type: 'text' },
    ];

    // Questions definition (copied from user_form.js)
    // We need this to correctly render the summary view
    const questions = [
        { id: 'marital_status', text: "What is your marital status?", type: 'radio', field: 'marital_status', options: ['Single', 'Married', 'Divorced', 'Widowed'], isMandatory: true, category: 'Personal Profile', note: 'This information helps complete your profile for the application.' },
        { id: 'birth_place', text: "What is your place and country of birth?", type: 'group', table: 'personal', isMandatory: true, fields: [{ id: 'place_of_birth', placeholder: 'Place of Birth *', type: 'text' }, { id: 'country_of_birth', placeholder: 'Country of Birth *', type: 'select', options: countries }], category: 'Personal Profile', note: 'This must match your passport details exactly.' },
        { id: 'travel_sponsor', text: "Who will cover the costs of your trip?", type: 'sponsor-details', field: 'travel_covered_by', isMandatory: true, category: 'Financial & Sponsorship', note: 'Please select the primary source of funding for your trip.' },
        { id: 'occupation_status', text: "What is your current occupation?", type: 'radio', field: 'occupation_status', options: ['Employee', 'Self-Employed / Freelancer', 'Student', 'Retired', 'Unemployed / Homemaker / Volunteer / Intern'], isMandatory: true, category: 'Employment / Occupation', note: 'Your answer helps us understand your ties to your home country.' },
        { id: 'employee_details', text: "Please provide your employment details.", type: 'group', isMandatory: true, condition: (data) => data.occupation_status === 'Employee', fields: [{ id: 'occupation_title', placeholder: 'Job Title *' }, { id: 'company_name', placeholder: 'Company Name *' }, ...buildStructuredAddressFields('company'), { id: 'company_phone', placeholder: 'Company Phone *' }, { id: 'company_email', placeholder: 'Company Email *' }], category: 'Employment / Occupation', note: 'This information is used to verify your employment status.' },
        { id: 'self_employed_details', text: "Please provide your business details.", type: 'group', isMandatory: true, condition: (data) => data.occupation_status === 'Self-Employed / Freelancer', fields: [{ id: 'company_name', placeholder: 'Business Name *' }, ...buildStructuredAddressFields('company'), { id: 'company_phone', placeholder: 'Business Phone / Email' }], category: 'Employment / Occupation', note: 'Details about your business help establish your financial ties.' },
        { id: 'student_details', text: "Please provide your school/university details.", type: 'group', isMandatory: true, condition: (data) => data.occupation_status === 'Student', fields: [{ id: 'company_name', placeholder: 'School / University Name *' }, ...buildStructuredAddressFields('company'), { id: 'company_phone', placeholder: 'School Contact Information' }], category: 'Employment / Occupation', note: 'This helps confirm your status as a student.' },
        { id: 'retired_details', text: "Please confirm your retired status.", type: 'text', field: 'occupation_title', condition: (data) => data.occupation_status === 'Retired', placeholder: "e.g., Retired *", isMandatory: true, category: 'Employment / Occupation', note: "Confirming your status helps in understanding your financial support." },
        { id: 'unemployed_details', text: "Please confirm your current status.", type: 'text', field: 'occupation_title', condition: (data) => data.occupation_status === 'Unemployed / Homemaker / Volunteer / Intern', placeholder: "e.g., Homemaker *", isMandatory: true, category: 'Employment / Occupation', note: 'Please specify your current primary role.' },
        { id: 'credit_card', text: "Do you have a credit card?", type: 'radio', options: ['Yes', 'No'], field: 'has_credit_card', isMandatory: true, category: 'Financial & Sponsorship', note: 'You don’t need a credit card to get a Schengen visa. If you don’t have one, you can show bank statements, a sponsorship letter, or proof of prepaid travel and accommodation instead.' },
        { id: 'fingerprints', text: "Have you had your fingerprints collected for a previous Schengen visa?", type: 'radio', options: ['Yes', 'No'], field: 'fingerprints_taken', isMandatory: true, category: 'Travel History', note: 'If yes, your VIS data may be reused, simplifying the process.' },
        { id: 'fingerprints_upload', text: "Please upload a clear picture of that visa.", type: 'file', field: 'schengen_visa_image', inputName: 'visa_image[]', condition: (data) => data.fingerprints_taken === 'Yes', isMandatory: true, category: 'Client Documents', note: 'Upload one or more files (PNG, JPG, PDF).' },
        { id: 'travel_dates', text: "What are your planned travel dates?", type: 'group', isMandatory: true, fields: [{ id: 'travel_date_from', label: 'Planned Departure:', type: 'date' }, { id: 'travel_date_to', label: 'Planned Return:', type: 'date' }], category: 'Travel Plans', note: 'Tip: A travel date at least 30 days after your appointment and a short trip of 2-3 days can improve approval chances.' },
        { id: 'travel_dates_confirm', text: "Please confirm your travel dates.", type: 'confirm-dates', isMandatory: true, category: 'Travel Plans', note: 'Please double-check the dates you have entered.' },
        { id: 'destination', text: "What will be your primary destination city?", type: 'grouped-select', field: 'primary_destination', data: destinations, isMandatory: true, category: 'Travel Plans', note: 'Select the main city where you will spend the most time.' },
        { id: 'has_stay_booking', text: "Have you booked any stay based on the purpose of your visit?", type: 'radio', field: 'has_stay_booking', options: ['Yes', 'No'], isMandatory: true, category: 'Accommodation', note: 'This applies if you are traveling as a tourist.', condition: (qData, pData) => (pData.visa_type || '').toLowerCase().includes('tourist') },
        { id: 'accommodation_details', text: "Where you will stay based on the purpose of your visit?", type: 'accommodation', isMandatory: true, category: 'Accommodation', note: 'Provide the full details of your stay.', condition: (qData, pData) => { const visaType = (pData.visa_type || '').toLowerCase(); if (visaType.includes('tourist')) { return qData.has_stay_booking === 'Yes'; } return true; } },
        { id: 'bookings', text: "Have you booked any of the following? (Flight, Train, etc.)", type: 'radio', field: 'has_bookings', options: ['Yes', 'No'], isMandatory: true, category: 'Bookings', note: 'This includes flights, trains, cruises, or holiday packages.' },
        { id: 'bookings_upload', text: "Please upload your booking document(s).", type: 'file', field: 'booking_documents_path', inputName: 'booking_document[]', condition: (data) => data.has_bookings === 'Yes', isMandatory: true, category: 'Client Documents', note: 'Upload one or more files (PNG, JPG, PDF).' },
        {
            id: 'evisa_details',
            text: 'eVisa Information',
            type: 'evisa-details',
            isMandatory: false, // Can be skipped
            category: 'Client Documents',
            note: 'Please provide your eVisa details or upload documentation.',
            fields: [
                { id: 'evisa_issue_date', label: 'eVisa Issue Date', type: 'date' },
                { id: 'evisa_expiry_date', label: 'eVisa Expiry Date', type: 'date' },
                { id: 'evisa_no_date_settled', label: 'No date found - This is showing settled status', type: 'checkbox-text' }, // Will store 'Yes' or 'No'
                { id: 'evisa_document_path', label: 'Upload eVisa (Screenshot or PDF)', type: 'file', inputName: 'evisa_document[]', isMandatory: false } // Not mandatory
            ]
        },
        {
            id: 'share_code_details',
            text: 'Most Recent Share Code (Immigration Status)',
            type: 'share-code-details',
            isMandatory: false, // Can be skipped
            category: 'Client Documents',
            note: 'Share code must be valid for at least 30 days from the appointment date.',
            fields: [
                { id: 'share_code', label: 'Enter Share Code', type: 'text', isMandatory: false },
                { id: 'share_code_expiry_date', label: 'Share Code Expiry Date', type: 'date', isMandatory: false },
                { id: 'share_code_document_path', label: 'Upload Share Code Document (PDF format)', type: 'file', inputName: 'share_code_document[]', isMandatory: false, accept: 'application/pdf' } // Added accept
            ]
        }
    ];

    // Make arrays globally accessible for edit module (after they're fully defined)
    window.questions = questions;
    window.editablePersonalFields = editablePersonalFields;
    window.countries = countries;

    // --- NEW: Core Application Logic ---

    if (!recordId || !recordType) {
        $('.content-area').html('<div class="error-message" style="display: block;">Error: Record ID or Type not provided. Please close this tab.</div>');
        return;
    }

    // Define the personal fields that are stored in the main travelers/dependents table
    const personalFieldKeys = [
        'first_name', 'last_name', 'dob', 'nationality', 'passport_no', 'passport_issue', 'passport_expire',
        'contact_number', 'email', 'address_line_1', 'address_line_2', 'city', 'state_province', 'zip_code', 'country',
        'travel_country', 'visa_type', 'visa_center', 'package', 'place_of_birth', 'country_of_birth', 'traveler_id'
    ];

    // 1. --- DEV MODE: Authentication bypassed ---
    // TODO: Re-enable authentication for production
    // $.get('api/auth.php?action=check_session', function (sessionRes) {
    //     if (sessionRes.loggedin) {

    // 2. Fetch data from the admin endpoint (no auth check in dev mode)
    // DEV MODE: Using Spring Boot REST API (Java backend)
    // Spring Boot uses /api/travelers/{id} pattern, not PHP's travelers.php?action=get&id=X
    const endpoint = recordType === 'traveler' ? `/api/travelers/${recordId}` : `/api/dependents/${recordId}`;
    const requestUrl = endpoint;

    console.log(`API REQUEST: GET ${requestUrl} (No Payload)`);
    const apiStartTime = performance.now();

    $.get(requestUrl, res => {
        const apiEndTime = performance.now();
        console.log(`API RESPONSE TIME: ${(apiEndTime - apiStartTime).toFixed(2)}ms`);
        console.log(`API SUCCESS: GET ${requestUrl}`, res);

        if (res.status === 'success' && res.data) {
            // Helper to map camelCase (Spring Boot backend) to snake_case (frontend)
            function mapToSnakeCase(data) {
                if (Array.isArray(data)) {
                    return data.map(item => mapToSnakeCase(item));
                } else if (data !== null && typeof data === 'object') {
                    return Object.keys(data).reduce((acc, key) => {
                        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

                        // DEBUG: Log address field conversions
                        if (key === 'addressLine1' || key === 'addressLine2') {
                            console.log(`🔧 Converting: ${key} => ${snakeKey}`);
                        }

                        acc[snakeKey] = mapToSnakeCase(data[key]);

                        // Fix for address line mapping difference (addressLine1 -> address_line1 vs address_line_1)
                        if (snakeKey === 'address_line1') acc['address_line_1'] = acc[snakeKey];
                        if (snakeKey === 'address_line2') acc['address_line_2'] = acc[snakeKey];

                        // Fix for company address line mapping (companyAddress1 -> company_address1 vs company_address_1)
                        if (snakeKey === 'company_address1') acc['company_address_1'] = acc[snakeKey];
                        if (snakeKey === 'company_address2') acc['company_address_2'] = acc[snakeKey];

                        // Fix for document field mapping (backend camelCase -> frontend snake_case question IDs)
                        if (snakeKey === 'booking_document') acc['booking_documents_path'] = acc[snakeKey];
                        if (snakeKey === 'evisa_document') acc['evisa_document_path'] = acc[snakeKey];
                        if (snakeKey === 'share_code_document') acc['share_code_document_path'] = acc[snakeKey];
                        // schengen_visa_image usually matches, but ensure consistency if needed
                        if (snakeKey === 'schengen_visa_image') acc['schengen_visa_image'] = acc[snakeKey];

                        return acc;
                    }, {});
                }
                return data;
            }

            // Convert camelCase to snake_case
            console.log('🔍 RAW API RESPONSE:', res.data); // Inspect the full object

            // Check specific logic fields
            console.log('🔍 DEBUG FIELD CHECK:', {
                'raw.maritalStatus': res.data.maritalStatus,
                'raw.marital_status': res.data.marital_status,
                'raw.questions': res.data.questions, // Maybe nested?
                'raw.travelerQuestions': res.data.travelerQuestions
            });

            const flatData = mapToSnakeCase(res.data);
            console.log('✅ Data loaded successfully');
            console.log('📋 Converted Data (snake_case):', flatData);
            console.log('📋 Flat Data Keys:', Object.keys(flatData));



            // 3. Normalize flat data into the { personal, questions } structure
            personalFieldKeys.forEach(key => {
                if (flatData[key] !== undefined) {
                    recordData.personal[key] = flatData[key];
                }
            });

            for (const [key, value] of Object.entries(flatData)) {
                if (personalFieldKeys.indexOf(key) === -1) {
                    recordData.questions[key] = value;
                }
            }

            // 🔍 DEBUG: Check what was stored in recordData.personal
            console.log('📦 ========== STORED PERSONAL DATA ==========');
            console.log('📍 recordData.personal.address_line_1:', recordData.personal.address_line_1);
            console.log('📍 recordData.personal.address_line_2:', recordData.personal.address_line_2);
            console.log('📍 Full recordData.personal:', recordData.personal);
            console.log('📦 ==========================================');

            // Set lock status from 'form_complete' field
            isFormLocked = recordData.questions && (recordData.questions.form_complete === '1' || recordData.questions.form_complete === 1);
            window.isFormLocked = isFormLocked; // Keep window reference updated

            // 4. Render the UI
            $('#progress-bar-container').fadeIn();
            updateHeader();
            updateGlobalProgressBar();

            // Preload documents before rendering summary
            preloadDocumentFields().then(() => {
                const renderStartTime = performance.now();
                renderSummaryView();
                const renderEndTime = performance.now();
                console.log(`UI RENDER TIME: ${(renderEndTime - renderStartTime).toFixed(2)}ms`);
                recordData.applicationFormData = collectUserInformationFromFields();
                setupGenerateApplicationFormButton();
                setupLockUnlockButton();
                setupClickToCopy();
                setupAccommodationEditing(); // Enable accommodation editing
                checkClientDocumentStatus(); // Check for client-uploaded files

                // Initialize edit functionality
                initializeEditFunctionality();

                // Handle hash navigation (for direct links to sections)
                handleHashNavigation();
            });

        } else {
            console.error('❌ API returned unsuccessful status or no data');
            console.error('Response:', res);
            $('.content-area').html(`<div class="error-message" style="display: block;">Error: ${res.message || 'Could not load record data.'}</div>`);
        }
    }, 'json').fail((jqXHR, textStatus, errorThrown) => {
        console.error('❌ ========== API REQUEST FAILED ==========');
        console.error('🔗 Request URL:', requestUrl);
        console.error('📊 Status:', textStatus);
        console.error('❌ Error:', errorThrown);
        console.error('📦 jqXHR Object:', jqXHR);
        console.error('📊 HTTP Status Code:', jqXHR.status);
        console.error('📄 Response Text:', jqXHR.responseText);
        console.error('📋 Ready State:', jqXHR.readyState);
        console.error('⏰ Error Time:', new Date().toLocaleTimeString());

        $('.content-area').html(`<div class="error-message" style="display: block;">Error: Server request failed. Check console for details.<br>Status: ${textStatus}<br>HTTP Code: ${jqXHR.status}</div>`);
    });

    //     } else {
    //         // Not logged in
    //         $('.form-container').html('<div class="content-area"><div class="error-message" style="display: block; text-align: center;">Access Denied. Please log in to the VisaD Vault and access this page from there.</div></div>');
    //     }
    // });


    function navigateTo(viewId) {
        $('.view.active').removeClass('active');
        $(viewId).addClass('active');
        currentView = viewId;
    }

    function updateHeader() {
        $('#header-title').text('Client Form Data');
        const p = recordData.personal || {};
        const q = recordData.questions || {};
        const name = (p.first_name || '') + ' ' + (p.last_name || '');
        const country = p.travel_country || '[Destination]';
        const visaType = p.visa_type || '[Visa Type]';
        const center = p.visa_center || '[Visa Center]';
        const pkg = p.package || '[Package]';

        // Remove subtitle
        $('#header-subtitle').hide();

        // NEW: Display appointment date (stored as doc_date in database)
        const appointmentDate = q.doc_date || p.doc_date;
        if (appointmentDate && appointmentDate !== '' && appointmentDate !== '0000-00-00') {
            // Format the date nicely
            const dateObj = new Date(appointmentDate);
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const formattedDate = dateObj.toLocaleDateString('en-GB', options);

            $('#appointment-date-text').text(formattedDate);
            $('#appointment-date-display').fadeIn();
        } else {
            $('#appointment-date-display').hide();
        }

        // NEW: Display co-travellers information
        loadCoTravellers();

        // Update the fixed client info header
        const fullName = (p.first_name || '') + ' ' + (p.last_name || '');
        $('#client-name').text(fullName.toUpperCase() || 'Client Name');
        $('#visa-country').text(country);
        $('#visa-type').text(visaType);
        $('#application-city').text(center);
        $('#package-type').text(pkg);

        // Highlight Full Support package
        if (pkg && pkg.toLowerCase().includes('full support')) {
            $('#package-type').addClass('highlight-package');
        } else {
            $('#package-type').removeClass('highlight-package');
        }
    }

    // NEW: Load co-travellers information
    function loadCoTravellers() {
        const p = recordData.personal || {};
        const travelerId = p.traveler_id; // For dependents, this will have the main traveler ID
        const currentId = recordId;

        // Hide section initially
        $('#co-travellers-section').hide();

        console.log('Loading co-travellers:', {
            recordType: recordType,
            currentId: currentId,
            travelerId: travelerId,
            personalData: p
        });

        let mainTravelerId;

        if (recordType === 'traveler') {
            // Current record is main traveler
            mainTravelerId = currentId;
        } else if (recordType === 'dependent' && travelerId) {
            // Current record is co-traveller
            mainTravelerId = travelerId;
        } else {
            console.log('Cannot determine main traveler ID');
            return;
        }

        // Fetch all travellers (main + dependents) and display them together
        const allTravellers = [];

        // Fetch the main traveler using Spring Boot REST API
        // Spring Boot returns dependents as part of the traveler object
        $.get(`/api/travelers/${mainTravelerId}`, function (mainRes) {
            console.log('Main traveler response:', mainRes);
            console.log('Main traveler ID from API:', mainRes.data?.id, 'Expected:', mainTravelerId);

            if (mainRes.status === 'success' && mainRes.data) {
                // Mark as main traveller
                const travelerData = mainRes.data;
                travelerData.is_main = true;
                travelerData.traveller_type = 'traveler';
                travelerData.id = mainTravelerId; // FORCE the ID to be correct
                console.log('Main traveler added to list with ID:', travelerData.id, 'Name:', travelerData.first_name);
                allTravellers.push(travelerData);

                // Get dependents from the traveler response (Spring Boot includes them)
                console.log('Dependents from traveler response:', travelerData.dependents);
                console.log('Number of dependents:', travelerData.dependents?.length || 0);

                // Process dependents if they exist
                if (travelerData.dependents && travelerData.dependents.length > 0) {
                    travelerData.dependents.forEach((dep, index) => {
                        dep.is_main = false;
                        dep.traveller_type = 'dependent';
                        console.log(`Dependent ${index + 1} - ID: ${dep.id}, Name: ${dep.first_name || dep.firstName}`);
                        allTravellers.push(dep);
                    });
                }

                // Display all travellers together
                if (allTravellers.length > 0) {
                    console.log('=== FILTERING CO-TRAVELLERS ===');
                    console.log('All travellers fetched:', allTravellers.map(t => ({ id: t.id, name: t.first_name || t.firstName, is_main: t.is_main })));
                    console.log('Current viewing - ID:', currentId, '(type:', typeof currentId, ') Type:', recordType);

                    // Display all travellers except the current one being viewed
                    const travellersToDisplay = allTravellers.filter(t => {
                        const tId = parseInt(t.id);
                        const currentIdInt = parseInt(currentId);

                        console.log(`  Checking: ${t.first_name || t.firstName || t.name} (ID: ${tId} / ${t.id}, is_main: ${t.is_main})`);
                        console.log(`    Comparing with current: ${currentIdInt} / ${currentId}, recordType: ${recordType}`);
                        console.log(`    Types - tId: ${typeof tId}, currentIdInt: ${typeof currentIdInt}`);
                        console.log(`    Raw comparison: ${t.id} === ${currentId} = ${t.id === currentId}`);
                        console.log(`    Int comparison: ${tId} === ${currentIdInt} = ${tId === currentIdInt}`);
                        console.log(`    String comparison: "${String(t.id)}" === "${String(currentId)}" = ${String(t.id) === String(currentId)}`);

                        // RULE 1: If viewing main traveller, NEVER show anyone with is_main=true
                        if (recordType === 'traveler' && t.is_main === true) {
                            console.log(`    ❌ EXCLUDED - Viewing main traveler, excluding main (is_main=true)`);
                            return false;
                        }

                        // RULE 2: If IDs match exactly, exclude
                        const idsMatch = (tId === currentIdInt) || (String(t.id) === String(currentId)) || (t.id == currentId);
                        console.log(`    IDs Match Check: ${idsMatch}`);

                        if (idsMatch) {
                            console.log(`    ❌ EXCLUDED - ID matches current user`);
                            return false;
                        }

                        console.log(`    ✅ INCLUDED - Will be displayed`);
                        return true;
                    });

                    console.log('Final travellers to display:', travellersToDisplay.map(t => ({ id: t.id, name: t.first_name || t.firstName })));
                    console.log('=== END FILTERING ===');

                    if (travellersToDisplay.length > 0) {
                        // Get names for header
                        const names = travellersToDisplay.map(t => t.first_name || t.firstName || t.name?.split(' ')[0] || '').filter(n => n).join(', ').toUpperCase();

                        if (names) {
                            $('#co-travellers-title').text('CO-TRAVELLERS (' + names + ')');
                        } else {
                            $('#co-travellers-title').text('CO-TRAVELLERS');
                        }

                        displayCoTravellers(travellersToDisplay);
                    } else {
                        console.log('⚠️ No other travellers to display after filtering');
                        $('#co-travellers-section').hide(); // Hide section if no other travellers
                    }
                } else {
                    console.log('⚠️ No travellers found at all');
                }
            }

        }, 'json').fail(function (xhr, status, error) {
            console.error('Failed to fetch main traveler:', error, xhr.responseText);
        });
    }

    function displayCoTravellers(travellers) {
        const $list = $('#co-travellers-list');
        $list.empty();

        // Safety check - don't show section if no travellers
        if (!travellers || travellers.length === 0) {
            console.log('displayCoTravellers called with no travellers - hiding section');
            $('#co-travellers-section').hide();
            return;
        }

        console.log('displayCoTravellers - Rendering', travellers.length, 'traveller(s)');
        console.log('Current user ID:', recordId, 'Type:', recordType);

        let displayedCount = 0;

        travellers.forEach(traveller => {
            const travellerId = traveller.id;
            const currentIdInt = parseInt(recordId);
            const travellerIdInt = parseInt(travellerId);

            // CRITICAL CHECK: Never display the current user
            if (travellerIdInt === currentIdInt || String(travellerId) === String(recordId)) {
                console.log(`🚫 SKIPPING: This is the current user (${traveller.first_name}, ID: ${travellerId})`);
                return; // Skip this traveller
            }

            console.log(`✅ RENDERING: ${traveller.first_name} (ID: ${travellerId})`);

            const firstName = traveller.first_name || traveller.name?.split(' ')[0] || 'N/A';
            const lastName = traveller.last_name || traveller.name?.split(' ').slice(1).join(' ') || '';
            const fullName = `${firstName} ${lastName}`.trim();
            const gender = traveller.gender || 'N/A';
            const dob = traveller.dob || 'N/A';
            const nationality = traveller.nationality || 'N/A';
            const passportNo = traveller.passport_no || 'N/A';
            const contact = traveller.contact_number || traveller.whatsapp_contact || 'N/A';
            const travellerType = traveller.traveller_type || 'traveler';
            const isMain = traveller.is_main ? ' (MAIN TRAVELLER)' : '';

            const $card = $(`
                <div class="co-traveller-card">
                    <div class="co-traveller-name">
                        <i class="fas fa-user"></i>
                        <span>${fullName.toUpperCase()}${isMain}</span>
                    </div>
                    <div class="co-traveller-details">
                        <div class="co-traveller-detail">
                            <span class="co-traveller-detail-label">Gender</span>
                            <span class="co-traveller-detail-value">${gender}</span>
                        </div>
                        <div class="co-traveller-detail">
                            <span class="co-traveller-detail-label">Date of Birth</span>
                            <span class="co-traveller-detail-value">${dob}</span>
                        </div>
                        <div class="co-traveller-detail">
                            <span class="co-traveller-detail-label">Nationality</span>
                            <span class="co-traveller-detail-value">${nationality}</span>
                        </div>
                        <div class="co-traveller-detail">
                            <span class="co-traveller-detail-label">Passport No.</span>
                            <span class="co-traveller-detail-value">${passportNo}</span>
                        </div>
                        <div class="co-traveller-detail">
                            <span class="co-traveller-detail-label">Contact</span>
                            <span class="co-traveller-detail-value">${contact}</span>
                        </div>
                    </div>
                    <button class="co-traveller-button" onclick="window.location.href='form_data_viewer.html?id=${travellerId}&type=${travellerType}'">
                        <i class="fas fa-external-link-alt"></i>
                        Access
                    </button>
                </div>
            `);

            $list.append($card);
            displayedCount++;
        });

        console.log(`Displayed ${displayedCount} traveller card(s)`);

        // If no cards were actually displayed, hide the section
        if (displayedCount === 0) {
            console.log('⚠️ No traveller cards rendered - hiding section');
            $('#co-travellers-section').hide();
        } else {
            $('#co-travellers-section').fadeIn();

            // Start collapsed by default
            $('#co-travellers-list').removeClass('expanded');
            $('#co-travellers-chevron').removeClass('rotated');

            // Setup toggle functionality for co-travellers section
            $('#co-travellers-toggle').off('click').on('click', function () {
                const $list = $('#co-travellers-list');
                const $chevron = $('#co-travellers-chevron');

                // Toggle the expanded class
                $list.toggleClass('expanded');
                $chevron.toggleClass('rotated');
            });
        }
    }

    // --- NEW: Click-to-copy handler ---
    function setupClickToCopy() {
        $(document).on('click', '.info-item:not(.read-only):not(.full-width) .display-value', function (e) {
            // Don't copy if the section is in edit mode (REMOVED, NO EDIT MODE)
            // if ($(this).closest('.section').hasClass('editing')) return;

            const textToCopy = $(this).text().trim();
            if (textToCopy && textToCopy.toLowerCase() !== 'not set') {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalColor = $(this).css('color');
                    const originalBg = $(this).css('background-color');
                    // Show feedback
                    $(this).css({ 'background-color': '#d1fae5', 'color': '#065f46', 'font-weight': '600' });
                    setTimeout(() => $(this).css({ 'background-color': originalBg, 'color': originalColor, 'font-weight': '500' }), 500);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                });
            }
        });
    }

    // --- NEW: Accommodation Editing Logic ---
    function setupAccommodationEditing() {
        // 1. Toggle has_stay_booking (Yes/No)
        $(document).on('dblclick', '.info-item[data-field="has_stay_booking"]', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const $valElement = $(this).find('.display-value');
            const currentVal = $valElement.text().trim();
            // Basic toggle: if text contains "Yes", switch to "No", else "Yes"
            // (Note: display value usually matches raw value for radios, but let's be safe)
            const newVal = (currentVal === 'Yes' || currentVal === 'yes') ? 'No' : 'Yes';

            // If switching to No, warn user
            if (newVal === 'No') {
                if (!confirm('Are you sure you want to revert to "No"? Accommodation details will be hidden.')) {
                    return;
                }
            } else {
                if (!confirm('Do you want to enable "Yes" and fill accommodation details?')) {
                    return;
                }
            }

            updateQuestionField('has_stay_booking', newVal, () => {
                recordData.questions.has_stay_booking = newVal;
                // Simply re-rendering the whole view is safest to show/hide fields correctly
                renderSummaryView();

                if (newVal === 'Yes') {
                    // Scroll to it
                    setTimeout(() => {
                        const section = $('#section-accommodation');
                        if (section.length) {
                            section[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 300);
                }
            });
        });

        // 2. Edit accommodation details
        $(document).on('dblclick', '#section-accommodation .info-item', function (e) {
            const $item = $(this);
            const fieldId = $item.data('field');

            // Skip toggle field (handled above)
            if (fieldId === 'has_stay_booking') return;

            // Should be handled by toggle above

            if ($item.hasClass('editing')) return; // Already editing

            const $display = $item.find('.display-value');
            if ($display.length === 0) return;

            const currentText = $display.text().trim();
            const currentValue = (currentText === 'Not set' || currentText === 'Not set' || $display.find('i').length > 0) ? '' : currentText;

            $item.addClass('editing');

            // Simple text input for all for now
            const $input = $('<input type="text" class="edit-input" style="width: 100%; padding: 4px; border: 1px solid #2563eb; border-radius: 4px;" />').val(currentValue);

            // Store original html to restore on cancel (esc)
            const originalHtml = $display.html();

            $display.html($input);
            $input.focus();

            // Save on blur or enter
            $input.on('blur keydown', function (e) {
                if (e.type === 'keydown') {
                    if (e.key === 'Enter') {
                        $(this).blur(); // Trigger save
                        return;
                    }
                    if (e.key === 'Escape') {
                        // Cancel
                        $display.html(originalHtml);
                        $item.removeClass('editing');
                        return;
                    }
                    return;
                }

                const newValue = $(this).val();

                // Save to server
                updateQuestionField(fieldId, newValue, () => {
                    // Update local data
                    recordData.questions[fieldId] = newValue;

                    // Update UI
                    $item.removeClass('editing');
                    $display.text(newValue || '');
                    if (!newValue) {
                        $display.addClass('not-set').html('<i>Not set</i>');
                    } else {
                        $display.removeClass('not-set');
                    }
                });
            });
        });
    }

    function updateQuestionField(field, value, onSuccess) {
        // --- FIX: Map mismatched frontend fields to backend fields ---
        // Legacy mapping removed - Backend now supports these fields directly

        // -------------------------------------------------------------

        const camelCaseField = snakeToCamelCase(field);
        const endpoint = recordType === 'traveler'
            ? `/api/travelers/${recordId}/bulk`
            : `/api/dependents/${recordId}/bulk`;

        console.log(`🔄 Updating question field: ${field} (${camelCaseField}) = "${value}"`);

        $.ajax({
            url: endpoint,
            type: 'PATCH',
            contentType: 'application/json',
            data: JSON.stringify({
                updates: {
                    [camelCaseField]: value
                }
            }),
            dataType: 'json',
            success: function (res) {
                console.log('✅ Update successful:', res);
                if (res.status === 'success') {
                    if (onSuccess) onSuccess();
                } else {
                    alert('Error updating field: ' + (res.message || 'Unknown error'));
                }
            },
            error: function (xhr, status, error) {
                console.error('❌ Server error:', {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    responseText: xhr.responseText
                });
                alert('Server error while saving. Please check connection.');
            }
        });
    }

    // --- NEW: Lock/Unlock Button Logic (Client-side only) ---
    // --- NEW: Lock/Unlock Button Logic (Client-side only) ---
    function setupLockUnlockButton() {
        const badgeHeader = $('#form-status-badge-header');
        const toggleCheckbox = $('#lock-toggle-checkbox');

        updateLockUI(); // Set initial state based on isFormLocked

        // Click handler for header badge (legacy)
        badgeHeader.on('click', function () {
            toggleLock();
        });

        // Change handler for top toggle switch
        toggleCheckbox.on('change', function (e) {
            // Prevent default because toggleLock handles the actual switch logic via API
            // But checkbox change has already happened visually. 
            // We'll let toggleLock run, and if it fails, updateLockUI will revert it.
            toggleLock();
        });
    }

    function toggleLock() {
        const newLockState = isFormLocked ? 0 : 1; // 0 = unlock, 1 = lock

        const badgeHeader = $('#form-status-badge-header');
        const $toggleCheckbox = $('#lock-toggle-checkbox');

        // Disable input to prevent double clicks
        badgeHeader.css('pointer-events', 'none').css('opacity', '0.6');
        $toggleCheckbox.prop('disabled', true);

        // Use the bulk update API to update the formComplete field
        const endpoint = recordType === 'traveler'
            ? `/api/travelers/${recordId}/bulk`
            : `/api/dependents/${recordId}/bulk`;

        console.log(`🔒 Toggling lock status to: ${newLockState} via ${endpoint}`);

        $.ajax({
            url: endpoint,
            type: 'PATCH',
            contentType: 'application/json',
            data: JSON.stringify({
                updates: {
                    formComplete: newLockState
                }
            }),
            dataType: 'json',
            success: function (res) {
                console.log('✅ Lock status updated:', res);
                if (res.status === 'success') {
                    isFormLocked = newLockState == 1; // Update state
                    window.isFormLocked = isFormLocked; // Keep window reference updated
                    recordData.questions.form_complete = newLockState; // Update local data
                    updateLockUI();
                } else {
                    alert('Error updating lock status: ' + (res.message || 'Unknown error'));
                    // Revert UI if needed (updateLockUI will fix it)
                }
            },
            error: function (xhr, status, error) {
                console.error('❌ Server error updating lock status:', {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    responseText: xhr.responseText
                });
                alert('Server error while updating lock status.');
            },
            complete: function () {
                badgeHeader.css('pointer-events', 'auto').css('opacity', '1');
                $toggleCheckbox.prop('disabled', false);
                updateLockUI(); // Ensure UI is correct even on fail
            }
        });
    }

    function updateLockUI() {
        const badgeHeader = $('#form-status-badge-header');
        const iconHeader = $('#lock-icon');
        const statusText = $('#lock-status-text');

        // New Toggle UI Elements
        const $toggleWrapper = $('#lock-toggle-wrapper');
        const $toggleCheckbox = $('#lock-toggle-checkbox');
        const $lockLabel = $('#lock-status-label');
        const $sliderIcon = $('#lock-slider-icon');

        if (isFormLocked) {
            // Update header badge
            badgeHeader.addClass('locked');
            iconHeader.removeClass('fa-lock-open').addClass('fa-lock');
            statusText.text('Form Locked');

            // Update Toggle Switch
            $toggleWrapper.addClass('locked');
            $toggleCheckbox.prop('checked', true);
            $lockLabel.text('Locked');
            $sliderIcon.removeClass('fa-lock-open').addClass('fa-lock');

            $('.form-container').addClass('locked');
            $('#summary-final-message').html('<i class="fas fa-lock"></i> Form is locked.').show();
        } else {
            // Update header badge
            badgeHeader.removeClass('locked');
            iconHeader.removeClass('fa-lock').addClass('fa-lock-open');
            statusText.text('Form Unlocked');

            // Update Toggle Switch
            $toggleWrapper.removeClass('locked');
            $toggleCheckbox.prop('checked', false);
            $lockLabel.text('Unlocked');
            $sliderIcon.removeClass('fa-lock').addClass('fa-lock-open');

            $('.form-container').removeClass('locked');
            $('#summary-final-message').hide();
        }
    }


    // --- Summary View Logic (Copied from user_form.js) ---
    // (This section is largely unchanged from user_form.js, as it's
    // responsible for rendering the summary view we want)

    function renderSummaryView() {
        if (isFormLocked) {
            $('.form-container').addClass('locked');
            $('#summary-final-message').html('<i class="fas fa-lock"></i> This form is locked.').show();
        } else {
            $('#summary-final-message').hide();
        }

        // 1. Locked Information
        const lockedGrid = $('#summary-locked-grid');
        lockedGrid.empty();
        const staticFields = [{ id: 'first_name', label: 'First Name' }, { id: 'last_name', label: 'Last Name' }, { id: 'dob', label: 'Date of Birth', type: 'date' }, { id: 'nationality', label: 'Nationality' }, { id: 'passport_no', label: 'Passport No.' }, { id: 'passport_issue', label: 'Passport Issue', type: 'date' }, { id: 'passport_expire', label: 'Passport Expire', type: 'date' }];
        staticFields.forEach(f => lockedGrid.append(createSummaryInfoItem(f.id, f.label, recordData.personal[f.id], {}, { type: f.type || 'text' }, false)));

        // 2. Personal Details
        const personalGrid = $('#summary-personal-grid');
        personalGrid.empty();
        editablePersonalFields.forEach(id => {
            let label = id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (id === 'zip_code') label = 'Postal Code';
            const isMandatory = mandatoryPersonalFields.includes(id);
            personalGrid.append(createSummaryInfoItem(id, label, recordData.personal[id], { table: 'personal' }, { type: 'text' }, false, isMandatory));
        });

        // 3. Questions Grid
        const qData = recordData.questions || {};
        const pData = recordData.personal || {};
        const questionsGrid = $('#summary-questions-grid');
        questionsGrid.empty();

        const allRelevantFields = new Map();

        questions.forEach(q => {
            if (q.id === 'accommodation_details') {
                if (q.condition && q.condition(qData, pData)) {
                    const visaType = (pData.visa_type || '').toLowerCase();
                    let accommodationFields = [];

                    if (visaType.includes('tourist')) {
                        accommodationFields = [
                            { id: 'hotel_name', label: 'Hotel Name', type: 'text' }, { id: 'hotel_address_1', label: 'Address Line 1', type: 'text' },
                            { id: 'hotel_address_2', label: 'Address Line 2', type: 'text' }, { id: 'hotel_city', label: 'City', type: 'text' },
                            { id: 'hotel_state', label: 'State/Province', type: 'text' }, { id: 'hotel_zip', label: 'Postal Code', type: 'text' },
                            { id: 'hotel_contact_number', label: 'Hotel Contact', type: 'text' }, { id: 'hotel_booking_reference', label: 'Booking Reference', type: 'text' }
                        ];
                    } else if (visaType.includes('family') || visaType.includes('friend')) {
                        accommodationFields = [
                            { id: 'inviting_person_first_name', label: 'Inviting Person First Name', type: 'text' }, { id: 'inviting_person_surname', label: 'Inviting Person Surname', type: 'text' },
                            { id: 'inviting_person_email', label: 'Inviting Person Email', type: 'text' },
                            { id: 'inviting_person_phone_code', label: 'Inviting Person Phone Code', type: 'text', col_class: 'half' }, { id: 'inviting_person_phone', label: 'Inviting Person Phone', type: 'text', col_class: 'half' },
                            { id: 'inviting_person_relationship', label: 'Relationship', type: 'text' },
                            { id: 'inviting_person_address_1', label: 'Address Line 1', type: 'text' }, { id: 'inviting_person_address_2', label: 'Address Line 2', type: 'text' },
                            { id: 'inviting_person_city', label: 'City', type: 'text' }, { id: 'inviting_person_state', label: 'State/Province', type: 'text' }, { id: 'inviting_person_zip', label: 'Postal Code', type: 'text' }
                        ];
                    } else if (visaType.toLowerCase().includes('business')) {
                        accommodationFields = [
                            { id: 'inviting_company_name', label: 'Company Name', type: 'text' }, { id: 'inviting_company_contact_person', label: 'Contact Person', type: 'text' },
                            { id: 'inviting_company_address_1', label: 'Address Line 1', type: 'text' }, { id: 'inviting_company_address_2', label: 'Address Line 2', type: 'text' },
                            { id: 'inviting_company_city', label: 'City', type: 'text' }, { id: 'inviting_company_state', label: 'State/Province', type: 'text' }, { id: 'inviting_company_zip', label: 'Postal Code', type: 'text' }, { id: 'inviting_company_phone', label: 'Company Phone', type: 'text' }
                        ];
                    }

                    accommodationFields.forEach(f => {
                        allRelevantFields.set(f.id, { label: f.label, value: qData[f.id], question: q, fieldDef: f, isMandatory: (f.label.includes('*')) });
                    });
                }
                return;
            }

            if (q.id === 'travel_sponsor') {
                allRelevantFields.set(q.field, { label: q.text, value: qData[q.field], question: q, fieldDef: q, isMandatory: q.isMandatory });
                let sponsorFields = [];
                if (qData.travel_covered_by === 'Family Member / Family Member in the EU') {
                    sponsorFields = [
                        { id: 'sponsor_relation', label: 'Relation', type: 'select', options: ['Spouse / Civil Partner', 'Parent(s)', 'Sibling'] }, { id: 'sponsor_full_name', label: 'Full Name', type: 'text' },
                        { id: 'sponsor_address_1', label: 'Address Line 1', type: 'text' }, { id: 'sponsor_address_2', label: 'Address Line 2', type: 'text' },
                        { id: 'sponsor_city', label: 'City', type: 'text' }, { id: 'sponsor_state', label: 'State', type: 'text' }, { id: 'sponsor_zip', label: 'Postal Code', type: 'text' },
                        { id: 'sponsor_email', label: 'Email', type: 'text' }, { id: 'sponsor_phone', label: 'Phone', type: 'text' }
                    ];
                } else if (qData.travel_covered_by === 'Host / Company / Organisation') {
                    sponsorFields = [
                        { id: 'host_name', label: 'Host Name', type: 'text' }, { id: 'host_phone', label: 'Host Phone', type: 'text' }, { id: 'host_company_name', label: 'Company Name', type: 'text' },
                        { id: 'host_address_1', label: 'Address Line 1', type: 'text' }, { id: 'host_address_2', label: 'Address Line 2', type: 'text' },
                        { id: 'host_city', label: 'City', type: 'text' }, { id: 'host_state', label: 'State', type: 'text' }, { id: 'host_zip', label: 'Postal Code', type: 'text' },
                        { id: 'host_email', label: 'Email', type: 'text' }, { id: 'host_company_phone', label: 'Company Phone', type: 'text' }
                    ];
                }
                sponsorFields.forEach(f => {
                    allRelevantFields.set(f.id, { label: f.label, value: qData[f.id], question: q, fieldDef: f, isMandatory: (f.label.includes('*')) });
                });
                return;
            }

            if (!q.condition || q.condition(qData, pData)) {
                if (q.fields) {
                    q.fields.forEach(f => {
                        const value = (q.table === 'personal' ? pData : qData)[f.id];
                        let label = f.placeholder ? f.placeholder.replace(' *', '') : (f.label || f.id);
                        if (f.id.endsWith('_zip')) label = 'Postal Code';
                        allRelevantFields.set(f.id, { label, value, question: q, fieldDef: f, isMandatory: (f.placeholder || f.label || '').includes('*') });
                    });
                } else if (q.field) {
                    allRelevantFields.set(q.field, { label: q.text, value: qData[q.field], question: q, fieldDef: q, isMandatory: q.isMandatory });
                }
            }
        });

        const categoryOrder = ['Personal Profile', 'Financial & Sponsorship', 'Employment / Occupation', 'Travel Plans', 'Accommodation', 'Immigration Status', 'Travel History', 'Bookings', 'Client Documents'];

        const categoryIcons = {
            'Personal Profile': 'fa-user',
            'Financial & Sponsorship': 'fa-credit-card',
            'Employment / Occupation': 'fa-briefcase',
            'Travel Plans': 'fa-plane-departure',
            'Accommodation': 'fa-hotel',
            'Immigration Status': 'fa-passport',
            'Travel History': 'fa-history',
            'Bookings': 'fa-ticket-alt',
            'Client Documents': 'fa-file-user'
        };

        categoryOrder.forEach(category => {
            let fieldsInCategory = '';
            allRelevantFields.forEach((field, id) => {
                if (field.question.category === category) {
                    fieldsInCategory += createSummaryInfoItem(id, field.label, field.value, field.question, field.fieldDef, false, field.isMandatory);
                }
            });

            if (fieldsInCategory) {
                const iconClass = categoryIcons[category] || 'fa-info-circle';
                // Sanitize category name for ID - remove all special characters
                const sanitizedCategory = category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                let categoryHtml = `
                <div class="section" id="section-${sanitizedCategory}">
                    <div class="section-header">
                        <h3 class="section-title"><i class="fas ${iconClass}"></i> ${category}</h3>
                    </div>
                    <div class="info-grid">${fieldsInCategory}</div>
                </div>`;
                questionsGrid.append(categoryHtml);
            }
        });

        // Post-render setup for select2 (REMOVED, no edit)

        // Remove submission buttons, this is a viewer
        $('#summary-actions-container').empty();
    }

    function createSummaryInfoItem(id, label, value, questionDef, fieldDef, isReadOnly = false, isMandatory = false) {
        let displayValue = '';
        let itemClass = 'info-item';
        if (isReadOnly) itemClass += ' read-only';
        if (fieldDef.col_class === 'half') itemClass += ' col-span-half';

        if (fieldDef.type === 'file') {
            itemClass += ' full-width';
            let files = value;
            if (typeof files === 'string') {
                try { files = JSON.parse(files); } catch (e) { files = []; }
            }
            files = Array.isArray(files) ? files : [];
            displayValue = `
                <ul class="file-list" style="list-style: none; padding: 0; margin: 0;">${createFileLis(files, id) || '<li style="color: #94a3b8; font-style: italic;">No files uploaded.</li>'}</ul>
                <div style="margin-top: 8px;">
                    <button class="upload-file-btn btn-secondary" data-category="${id}" style="padding: 4px 10px; font-size: 13px;">
                        <i class="fas fa-upload"></i> Upload
                    </button>
                    <input type="file" id="upload-${id}" class="hidden-file-input" data-category="${id}" style="display: none;">
                </div>
            `;
        } else if (fieldDef.type === 'checkbox-text') {
            displayValue = value === 'Yes' ? 'Yes' : '<i>Not set</i>';
        } else if (fieldDef.type === 'date') {
            displayValue = formatDateForDisplay(value);
        } else {
            displayValue = value || '';
        }

        if (id === 'evisa_no_date_settled') {
            const issueDate = recordData.questions['evisa_issue_date'];
            const expiryDate = recordData.questions['evisa_expiry_date'];
            if (issueDate && expiryDate) {
                itemClass += ' hidden-field';
            }
        }

        return `
        <div class="${itemClass}" data-field="${id}" data-question-id="${questionDef.id || ''}" data-table="${questionDef.table || 'questions'}">
            <label>${label} ${isMandatory ? '<span class="mandatory-marker">*</span>' : ''}</label>
            <div class="display-value ${!value ? 'not-set' : ''}">${displayValue || '<i>Not set</i>'}</div>
            <!-- REMOVED Edit Input Wrapper -->
        </div>`;
    }

    // REMOVED createEditInput function

    function setupGenerateApplicationFormButton() {
        $(document)
            .off('click.generateApplicationForm', '#generate-application-form-btn')
            .on('click.generateApplicationForm', '#generate-application-form-btn', function () {
                if ($('.info-item').length === 0) {
                    alert('Client data is still loading. Please try again in a moment.');
                    return;
                }

                const applicationFormObject = collectUserInformationFromFields();
                recordData.applicationFormData = applicationFormObject;
                window.generatedApplicationFormData = applicationFormObject;

                // Expanded debug logging for troubleshooting
                try {
                    console.group('Application Form Debug');
                    console.log('Application form data object generated:', applicationFormObject);
                    console.log('Record context snapshot:', {
                        recordId: typeof recordId !== 'undefined' ? recordId : null,
                        recordType: typeof recordType !== 'undefined' ? recordType : null,
                        recordData
                    });
                    console.groupEnd();
                } catch (e) {
                    console.log('Application form data object generated:', applicationFormObject);
                }

                // Optional POST to external endpoint (set window.APPLICATION_FORM_POST_URL to your IP/URL)
                const postUrl =
                    (typeof window !== 'undefined' && (window.APPLICATION_FORM_POST_URL || window.APPLICATION_FORM_POST_IP)) || null;
                if (postUrl) {
                    const payload = {
                        recordId: typeof recordId !== 'undefined' ? recordId : null,
                        recordType: typeof recordType !== 'undefined' ? recordType : null,
                        applicationForm: applicationFormObject,
                        timestamp: new Date().toISOString()
                    };
                    postApplicationForm(postUrl, payload)
                        .then((res) => {
                            console.log('POST /application-form response:', res);
                        })
                        .catch((err) => {
                            console.error('POST /application-form failed:', err);
                        });
                } else {
                    console.warn('APPLICATION_FORM_POST_URL not set. Define window.APPLICATION_FORM_POST_URL to enable POST.');
                }

                showGenerateButtonFeedback($(this));
            });
    }

    function postApplicationForm(url, data) {
        return fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            // Do not send credentials by default to arbitrary IPs
            credentials: 'omit',
            cache: 'no-store'
        }).then(async (resp) => {
            const text = await resp.text().catch(() => '');
            let parsed = null;
            try { parsed = text ? JSON.parse(text) : null; } catch (_) { /* non-JSON response */ }
            if (!resp.ok) {
                const error = new Error(`Request failed with ${resp.status}`);
                error.response = parsed || text;
                throw error;
            }
            return parsed ?? text ?? { ok: true };
        });
    }

    // Delegated handler for "Generate Application Form" button inside Documents section
    // Note: CSS id contains '+', which must be escaped in selector
    $(document)
        .off('click.generateApplicationFormDocSection', '#passport\\+date')
        .on('click.generateApplicationFormDocSection', '#passport\\+date', function (e) {
            e.preventDefault();

            // Collect data similarly to the main generator
            const applicationFormObject = collectUserInformationFromFields();

            const url =
                (typeof window !== 'undefined' && (window.APPLICATION_FORM_POST_URL || window.APPLICATION_FORM_POST_IP))
                || '/api/application-form/generate';

            const payload = {
                recordId: typeof recordId !== 'undefined' ? recordId : null,
                recordType: typeof recordType !== 'undefined' ? recordType : null,
                applicationForm: applicationFormObject,
                source: 'documents_section_button',
                timestamp: new Date().toISOString()
            };

            postApplicationForm(url, payload)
                .then(() => {
                    console.log('Generate Application Form: POST successful');
                })
                .catch((err) => {
                    console.error('Generate Application Form: POST failed', err);
                });
        });

    function collectUserInformationFromFields() {
        const userInfo = {};

        $('.info-item').each(function () {
            const $item = $(this);
            const labelText = extractLabelText($item);
            const key = $item.data('field') || generateKeyFromLabel(labelText);
            const value = extractDisplayValue($item.find('.display-value'));

            if (key) {
                userInfo[key] = value;
            } else if (labelText) {
                userInfo[labelText] = value;
            }
        });

        return userInfo;
    }

    function extractLabelText($infoItem) {
        const $label = $infoItem.find('label').clone();
        $label.find('.mandatory-marker').remove();
        return $label.text().trim();
    }

    function extractDisplayValue($displayElement) {
        if (!$displayElement || !$displayElement.length) {
            return '';
        }

        const $fileList = $displayElement.find('ul.file-list');
        if ($fileList.length) {
            const files = [];
            $fileList.find('a').each(function () {
                files.push({
                    name: $(this).text().trim(),
                    url: $(this).attr('href')
                });
            });
            return files;
        }

        const textValue = $displayElement.text().replace(/\s+/g, ' ').trim();
        if (!textValue || textValue.toLowerCase() === 'not set') {
            return '';
        }

        return textValue;
    }

    function generateKeyFromLabel(labelText) {
        if (!labelText) return '';
        return labelText
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function showGenerateButtonFeedback($button) {
        if (!$button || !$button.length) return;

        const originalHtml = $button.data('original-html') || $button.html();
        $button.data('original-html', originalHtml);

        $button
            .prop('disabled', true)
            .html('<i class="fas fa-check-circle"></i> Data Collected');

        setTimeout(() => {
            $button.prop('disabled', false).html(originalHtml);
        }, 2000);
    }

    function createFileLis(files, db_field) {
        if (!Array.isArray(files) || files.length === 0) return '';
        return files.map(f => {
            let fileUrl;
            let filename;
            let isClientFile = false; // Flag to determine delete logic

            if (typeof f === 'object' && f !== null && f.url) {
                // Handle object structure from fetchDocumentsByCategory
                fileUrl = f.url;
                filename = f.name || 'Document';
                // If it has Source=client_form, it's a client file
                if (f.source === 'client_form') isClientFile = true;
            } else {
                // Handle string path (legacy/direct DB value)
                // The value 'f' correctly contains the relative path like "2025/11/filename.pdf"
                // Check if it's already a full URL or relative
                if (f.startsWith('http') || f.startsWith('/')) {
                    fileUrl = f;
                } else {
                    fileUrl = `uploads/documents/client_documents/${f}`; // Base path + relative path
                }

                // Get just the filename from the path for display
                filename = f.includes('/') ? f.substring(f.lastIndexOf('/') + 1) : f;
                isClientFile = true; // Assume string paths in DB fields are client files
            }

            return `<li style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <a href="${fileUrl}" target="_blank" title="Click to view file" style="text-decoration: none; color: #2563eb;">
                    <i class="fas fa-file-pdf"></i> ${filename}
                </a> 
                <button class="delete-file-btn" data-filename="${filename}" data-category="${db_field}" title="Delete File" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 5px;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </li>`;
        }).join('');
    }

    // Preload document fields from API to ensure Summary View shows them
    function preloadDocumentFields() {
        return new Promise((resolve) => {
            const categoriesToLoad = [
                { category: 'bookings', field: 'booking_documents_path' },
                { category: 'evisa', field: 'evisa_document_path' },
                { category: 'share_code', field: 'share_code_document_path' },
                { category: 'schengen_visa', field: 'schengen_visa_image' }
            ];

            const promises = categoriesToLoad.map(item => {
                return fetchDocumentsByCategory(item.category).then(files => {
                    if (files && files.length > 0) {
                        // Update recordData.questions with the fetched files
                        // We store the full file objects so createFileLis can use them
                        if (!recordData.questions) recordData.questions = {};

                        // Merge with existing if any (though fetchDocumentsByCategory already does merge)
                        // Actually fetchDocumentsByCategory returns the merged list.
                        recordData.questions[item.field] = files;

                        console.log(`Preloaded ${files.length} files for ${item.field}`);
                    }
                });
            });

            Promise.all(promises).then(() => {
                resolve();
            });
        });
    }

    const renderDestinationSelect2 = (val, container = '.question-card') => {
        // This function is no longer needed as there's no edit mode,
        // but we keep it in case it's called by renderSummaryView
        // (which it shouldn't be, but safe to keep)
    };

    // --- REMOVED Summary Page Edit Logic ---

    // Note: Delete file logic is not included as it requires a specific API
    // and token which are not part of the admin API.

    function updateGlobalProgressBar() {
        // This logic is complex and specific to user_form.js
        // We can just show 100% or based on 'progress_percentage'
        const percentage = recordData.questions.progress_percentage || 0;
        $('#progress-bar').css('width', percentage + '%');
        $('#progress-text').text(`${percentage}%`);
        if (isFormLocked) {
            $('#progress-bar').css('width', '100%');
            $('#progress-text').text(`100% (Completed)`);
        }

        // NEW: Add badge to Locker Data button when progress is 100%
        if (percentage >= 100 || isFormLocked) {
            $(`.nav-item[data-action="locker-data"]`).addClass('has-files');
        } else {
            $(`.nav-item[data-action="locker-data"]`).removeClass('has-files');
        }

        return percentage;
    }

    const formatDateForDisplay = d => {
        if (!d) return '<i>Not set</i>';
        let parts = d.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            if (d === '0000-00-00') return '<i>Not set</i>';
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        parts = d.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
            return d;
        }
        return d;
    };

    // --- Covering Letter Functionality ---
    function setupCoveringLetterButton() {
        // Set active state for Locker Data button
        $('.nav-item[data-action="locker-data"]').addClass('active');

        // Setup handler for all action buttons
        $('.nav-item').each(function () {
            $(this).on('click', function () {
                const action = $(this).data('action');

                if (action === 'locker-data') {
                    // Already on this page - just scroll to top
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }

                const visaCountry = recordData.personal.travel_country || '';
                const visaType = recordData.personal.visa_type || '';

                // Check for covering letter
                if (action === 'covering-letter') {
                    const typeLower = visaType.toLowerCase();

                    // Check if Tourist visa
                    if (!typeLower.includes('tourist')) {
                        alert('Covering letter is currently only available for Tourist visa applications.');
                        return;
                    }

                    // Use universal Schengen template for ALL countries
                    // This template includes detailed content for Germany, France, Italy
                    // AND works for all other Schengen countries
                    const coveringLetterUrl = `covering_letter_schengen.html?id=${recordId}&type=${recordType}`;

                    // Navigate to covering letter
                    window.location.href = coveringLetterUrl;
                } else if (action === 'client-documents') {
                    const section = $(`#section-client-documents`);
                    if (section.length) {
                        section[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // Add a quick highlight effect
                        section.css('transition', 'all 0.3s ease');
                        section.css('box-shadow', '0 0 0 4px var(--primary-color)');
                        setTimeout(() => section.css('box-shadow', 'none'), 1500);
                    }
                } else if (action === 'checklist') {
                    // Checklist is handled by separate click handler below
                    showChecklistView();
                } else {
                    // For other actions
                    const url = getActionUrl(action);
                    if (url) {
                        window.location.href = url;
                    }
                    // Removed "coming soon" alert
                }
            });
        });
    }

    function getActionUrl(action) {
        const params = `?id=${recordId}&type=${recordType}`;

        switch (action) {
            case 'insurance':
            case 'flight':
            case 'application-form':
            case 'appointment':
            case 'hotel':
                return `document_upload.html${params}`;
            default:
                return null;
        }
    }

    // Setup the button handler after data is loaded
    setTimeout(() => {
        setupCoveringLetterButton();
        checkDocumentStatus();
        // checkClientDocumentStatus() is now called in the main .get success callback
    }, 1000);

    // Check document status for all categories
    function checkDocumentStatus() {
        const categories = ['insurance', 'flight', 'application', 'appointment', 'hotel'];
        const categoryToAction = {
            'insurance': 'insurance',
            'flight': 'flight',
            'application': 'application-form',
            'appointment': 'appointment',
            'hotel': 'hotel'
        };

        let completedCount = 0;
        const totalCategories = categories.length;

        categories.forEach(category => {
            $.get(`api/documents.php?action=get_documents&id=${recordId}&type=${recordType}&category=${category}`, function (res) {
                if (res.status === 'success' && res.documents && res.documents.length > 0) {
                    const action = categoryToAction[category];
                    $(`.nav-item[data-action="${action}"]`).addClass('has-files');
                    completedCount++;

                    // Check if all admin categories are complete
                    if (completedCount === totalCategories) {
                        $(`.nav-item[data-action="checklist"]`).addClass('has-files');
                    }
                }
            }, 'json');
        });
    }

    // NEW: Check status for client-uploaded documents
    function checkClientDocumentStatus() {
        const clientDocFields = ['evisa_document_path', 'share_code_document_path', 'schengen_visa_image', 'booking_documents_path'];
        let hasClientDocs = false;
        const qData = recordData.questions || {};

        for (const field of clientDocFields) {
            let files = qData[field];
            if (typeof files === 'string') {
                try { files = JSON.parse(files); } catch (e) { files = []; }
            }
            if (Array.isArray(files) && files.length > 0) {
                hasClientDocs = true;
                break;
            }
        }

        if (hasClientDocs) {
            $(`.nav-item[data-action="client-documents"]`).addClass('has-files');
        }
    }

    // Mobile menu toggle functionality
    $('#mobile-menu-toggle').on('click', function () {
        $(this).toggleClass('active');
        $('#action-buttons').toggleClass('expanded');
    });

    // Close mobile menu when clicking outside
    $(document).on('click', function (event) {
        if (!$(event.target).closest('.client-info-header').length) {
            $('#mobile-menu-toggle').removeClass('active');
            $('#action-buttons').removeClass('expanded');
        }
    });

    // Close mobile menu when an action button is clicked
    // ============================================
    // HORIZONTAL NAVIGATION FUNCTIONALITY
    // ============================================

    // Navigation item click handler (consolidated)
    $('.nav-item').on('click', function () {
        // Close mobile menu if open
        $('#mobile-menu-toggle').removeClass('active');
        $('#action-buttons').removeClass('expanded');

        const action = $(this).data('action');

        // Remove active class from all nav items
        $('.nav-item').removeClass('active');
        // Add active class to clicked item
        $(this).addClass('active');

        // Handle navigation actions
        if (action === 'locker-data') {
            showSummaryView();
        } else if (action === 'checklist') {
            showChecklistView();
        } else if (action === 'client-documents') {
            showClientDocumentsView();
        } else if (action === 'covering-letter') {
            // Navigate to covering letter page
            window.location.href = `covering_letter_schengen.html?id=${recordId}&type=${recordType}`;
        } else if (action === 'insurance' || action === 'flight' ||
            action === 'application-form' || action === 'appointment' ||
            action === 'hotel') {
            // Future functionality - for now just log the action
            console.log('Navigation action:', action);
            // You can add future views here as needed
        }
    });

    // Handle hash-based navigation (for direct links)
    function handleHashNavigation() {
        const hash = window.location.hash.substring(1); // Remove the # symbol

        if (hash === 'client-documents') {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                showClientDocumentsView();
            }, 100);
        } else if (hash === 'checklist') {
            setTimeout(() => {
                showChecklistView();
            }, 100);
        }
        // If no hash or hash is 'locker-data', stay on default view (already loaded)
    }

    // Also handle hash changes while on the page
    $(window).on('hashchange', function () {
        handleHashNavigation();
    });


    // Function to show checklist view
    function showChecklistView() {
        // Hide all views
        $('.view').removeClass('active').hide();
        // Show checklist view
        $('#checklist-view').addClass('active').show();

        // Update header
        $('#header-title').text('Application Checklist');
        $('#header-subtitle').text('Track your document submission status').show();

        // Set Checklist as active
        $('.nav-item').removeClass('active');
        $('.nav-item[data-action="checklist"]').addClass('active');

        // Load checklist data
        loadChecklistData();
    }

    // Function to show summary view (for back navigation)
    function showSummaryView() {
        // Hide all views
        $('.view').removeClass('active').hide();
        // Show summary view
        $('#summary-view').addClass('active').show();

        $('#header-title').text('Client Form Data');
        $('#header-subtitle').text('Review of all submitted information.').show();

        // Show all sections
        $('.section').show();

        // Set Locker Data as active
        $('.nav-item').removeClass('active');
        $('.nav-item[data-action="locker-data"]').addClass('active');
    }

    // Function to show Client Documents view
    function showClientDocumentsView() {
        // Hide all views
        $('.view').removeClass('active').hide();

        // Check if client-documents-view exists, if not create it
        if ($('#client-documents-view').length === 0) {
            // Create the client documents view div
            $('#checklist-view').after('<div id="client-documents-view" class="view"></div>');
        }

        // Show client documents view
        $('#client-documents-view').addClass('active').show();

        // Update header
        $('#header-title').text('Client Documents');
        $('#header-subtitle').text('Review uploaded documents organized by category').show();

        // Set Client Documents as active
        $('.nav-item').removeClass('active');
        $('.nav-item[data-action="client-documents"]').addClass('active');

        // Load and display categorized documents
        loadClientDocuments();
    }

    // Function to load and display client documents by category
    function loadClientDocuments() {
        // Show loading state in client-documents-view
        $('#client-documents-view').html(`
            <div class="section" style="text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #2563eb;"></i>
                <p style="margin-top: 20px; color: #64748b;">Loading documents...</p>
            </div>
        `);

        // Define document categories with their API category names and upload permissions
        const documentCategories = [
            { title: 'E-Visa Documents', apiCategory: 'evisa', icon: 'fa-id-card', description: 'UK E-Visa screenshots or PDF documents', allowUpload: true },
            { title: 'Share Code Documents', apiCategory: 'share_code', icon: 'fa-qrcode', description: 'UK immigration status share code documents', allowUpload: true },
            { title: 'Previous Schengen Visa', apiCategory: 'schengen_visa', icon: 'fa-passport', description: 'Previous Schengen visa images', allowUpload: true },
            { title: 'Booking Documents', apiCategory: 'bookings', icon: 'fa-ticket-alt', description: 'Travel booking confirmations', allowUpload: true },
            { title: 'Application Forms', apiCategory: 'application', icon: 'fa-file-alt', description: 'Visa application forms', allowUpload: true },
            { title: 'Insurance Documents', apiCategory: 'insurance', icon: 'fa-shield-alt', description: 'Travel insurance certificates', allowUpload: true },
            { title: 'Flight Tickets', apiCategory: 'flight', icon: 'fa-plane', description: 'Flight booking confirmations', allowUpload: true },
            { title: 'Hotel Bookings', apiCategory: 'hotel', icon: 'fa-hotel', description: 'Hotel reservation confirmations', allowUpload: true },
            { title: 'Appointment Confirmations', apiCategory: 'appointment', icon: 'fa-calendar-check', description: 'VFS/Consulate appointment confirmations', allowUpload: true }
        ];

        // Fetch all documents
        Promise.all(documentCategories.map(cat => fetchDocumentsByCategory(cat.apiCategory)))
            .then(results => {
                let html = '';
                let totalDocuments = 0;

                // Count total documents
                results.forEach(documents => {
                    if (documents && documents.length > 0) {
                        totalDocuments += documents.length;
                    }
                });

                // Add summary at the top
                html = `
                    <div class="section" style="margin-bottom: 20px;">
                        <div class="section-content">
                            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #2563eb; padding: 20px; border-radius: 8px;">
                                <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 1.1rem;">
                                    <i class="fas fa-file-alt"></i> Document Summary
                                </h3>
                                <p style="margin: 0; color: #475569; font-size: 0.95rem;">
                                    Total of <strong>${totalDocuments}</strong> document${totalDocuments > 1 ? 's' : ''} uploaded across all categories
                                </p>
                            </div>
                        </div>
                    </div>
                `;

                // Build HTML for each category (show ALL categories)
                documentCategories.forEach((category, index) => {
                    const documents = results[index] || [];
                    const hasDocuments = documents.length > 0;

                    html += `
                        <div class="section" style="margin-bottom: 25px;">
                            <div class="section-header">
                                <h3 class="section-title">
                                    <i class="fas ${category.icon}"></i> ${category.title}
                                </h3>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    ${hasDocuments ? `
                                        <span class="locked-badge" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                                            <i class="fas fa-check"></i> ${documents.length} file${documents.length > 1 ? 's' : ''}
                                        </span>
                                    ` : `
                                        <span class="locked-badge" style="background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);">
                                            <i class="fas fa-folder-open"></i> No files
                                        </span>
                                    `}
                                    ${category.allowUpload ? `
                                        <input type="file" id="quick-upload-${category.apiCategory}" class="quick-upload-input" data-category="${category.apiCategory}" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
                                        <button class="btn-primary btn-sm quick-upload-btn" data-category="${category.apiCategory}" style="margin: 0;">
                                            <i class="fas fa-upload"></i> Upload
                                        </button>
                                        ${category.apiCategory === 'application' ? `
                                            <button id="passport+date" class="btn-primary btn-sm" style="margin: 0;">
                                                <i class="fas fa-file-export"></i> Generate Application Form
                                            </button>
                                        ` : ''}
                                    ` : ''}
                                </div>
                            </div>
                            <div class="section-content">
                                <p style="color: #64748b; margin-bottom: 15px; font-size: 0.9rem;">
                                    <i class="fas fa-info-circle"></i> ${category.description}
                                </p>
                                
                                <!-- Quick upload progress indicator -->
                                <div id="quick-upload-progress-${category.apiCategory}" class="quick-upload-progress" style="display: none; margin-bottom: 15px; padding: 15px; background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px;">
                                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                        <i class="fas fa-spinner fa-spin" style="color: #2563eb;"></i>
                                        <span class="upload-status-text" style="color: #1e293b; font-weight: 600;">Uploading files...</span>
                                    </div>
                                    <div style="background: #e2e8f0; height: 6px; border-radius: 3px; overflow: hidden;">
                                        <div class="upload-progress-bar" style="background: linear-gradient(90deg, #2563eb 0%, #10b981 100%); height: 100%; width: 0%; transition: width 0.3s;"></div>
                                    </div>
                                </div>
                    `;

                    if (hasDocuments) {
                        html += `<div class="document-grid">`;

                        // Add each document
                        documents.forEach(doc => {
                            const fileName = doc.name || 'Document';
                            const fileUrl = doc.url || '#';
                            const uploadDate = doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : null;
                            const fileSize = doc.file_size ? formatFileSize(doc.file_size) : '';
                            const fileExt = fileName.split('.').pop().toUpperCase();
                            const isClientUpload = doc.source === 'client_form';
                            const fileId = doc.id || null;

                            html += `
                                <div class="document-card" data-file-id="${fileId}" data-category="${category.apiCategory}" data-file-name="${fileName}">
                                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                                        <div style="flex-shrink: 0;">
                                            <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #2563eb 0%, #10b981 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.75rem;">
                                                ${fileExt}
                                            </div>
                                        </div>
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                                                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: #1e293b; word-break: break-word;">
                                                    ${fileName}
                                                </h4>
                                                ${isClientUpload ? `
                                                    <span style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; white-space: nowrap;">
                                                        <i class="fas fa-user"></i> Client Upload
                                                    </span>
                                                ` : ''}
                                            </div>
                                            <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.8rem; color: #64748b; margin-bottom: 10px;">
                                                ${uploadDate ? `<span><i class="fas fa-calendar"></i> ${uploadDate}</span>` : ''}
                                                ${fileSize ? `<span><i class="fas fa-file"></i> ${fileSize}</span>` : ''}
                                            </div>
                                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                                <a href="${fileUrl}" target="_blank" class="file-link" style="display: inline-block;">
                                                    <i class="fas fa-eye"></i> View Document
                                                </a>
                                                <button class="btn-delete-file" data-file-id="${fileId}" data-file-name="${fileName}" data-category="${category.apiCategory}" data-is-client="${isClientUpload}" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px; transition: background 0.2s;">
                                                    <i class="fas fa-trash"></i> Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        });

                        html += `</div>`;
                    } else {
                        html += `
                            <div style="text-align: center; padding: 30px 20px; background: #f8fafc; border-radius: 8px; border: 2px dashed #cbd5e1;">
                                <i class="fas fa-folder-open" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 10px;"></i>
                                <p style="color: #64748b; margin: 0;">No documents uploaded yet</p>
                                ${category.allowUpload ? `<p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 0.85rem;">Click the Upload button above to add files</p>` : ''}
                            </div>
                        `;
                    }

                    html += `
                            </div>
                        </div>
                    `;
                });

                // Display the content
                $('#client-documents-view').html(html);

                // Attach upload button handlers
                setupUploadHandlers();

                // Attach delete button handlers
                setupDeleteHandlers();

                // Scroll to top
                $('html, body').animate({ scrollTop: 0 }, 300);
            })
            .catch(error => {
                console.error('Error loading documents:', error);
                $('#client-documents-view').html(`
                    <div class="section">
                        <div class="section-content" style="text-align: center; padding: 60px 20px;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #ef4444; margin-bottom: 20px;"></i>
                            <h3 style="color: #475569; margin-bottom: 10px;">Error Loading Documents</h3>
                            <p style="color: #64748b;">There was an error loading the documents. Please try again.</p>
                        </div>
                    </div>
                `);
            });
    }

    // Helper function to fetch documents by category
    function fetchDocumentsByCategory(category) {
        return new Promise((resolve) => {
            // First, get documents from the documents API
            $.get(`api/documents.php?action=get_documents&id=${recordId}&type=${recordType}&category=${category}`,
                function (res) {
                    let files = [];

                    // Add files from documents API
                    if (res.status === 'success' && res.documents && res.documents.length > 0) {
                        files = res.documents.map(doc => {
                            let fileUrl = doc.url || doc.file_path;
                            if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('/')) {
                                fileUrl = '/' + fileUrl;
                            }
                            return {
                                name: doc.original_filename || doc.name || doc.filename || 'Document',
                                url: fileUrl,
                                upload_date: doc.upload_date || doc.created_at,
                                file_size: doc.file_size || doc.size
                            };
                        });
                    }

                    // Additionally, check recordData.questions for client-uploaded files
                    const qData = recordData.questions || {};
                    const clientFiles = getClientUploadedFilesByCategory(category, qData);

                    // Merge both sources
                    files = files.concat(clientFiles);

                    resolve(files);
                }, 'json').fail(() => {
                    // Even if API fails, try to get client-uploaded files from form data
                    const qData = recordData.questions || {};
                    const clientFiles = getClientUploadedFilesByCategory(category, qData);
                    resolve(clientFiles);
                });
        });
    }

    // Helper function to extract client-uploaded files from form data by category
    function getClientUploadedFilesByCategory(category, qData) {
        const files = [];

        // Map category to field names in recordData.questions
        const categoryFieldMap = {
            'schengen_visa': ['schengen_visa_image'],
            'bookings': ['booking_documents_path'],
            'evisa': ['evisa_document_path'],
            'share_code': ['share_code_document_path']
        };

        const fieldNames = categoryFieldMap[category] || [];

        fieldNames.forEach(fieldName => {
            const fieldValue = qData[fieldName];

            console.log(`[File Path Debug] Category: ${category}, Field: ${fieldName}, Raw Value:`, fieldValue);

            if (fieldValue && fieldValue !== '') {
                // Parse the field value - it could be a single file or multiple files
                let filePaths = [];

                // Check if it's already an array (from API)
                if (Array.isArray(fieldValue)) {
                    filePaths = fieldValue;
                } else if (typeof fieldValue === 'string') {
                    // Check if it's a JSON array string
                    try {
                        if (fieldValue.trim().startsWith('[')) {
                            filePaths = JSON.parse(fieldValue);
                        } else {
                            filePaths = [fieldValue];
                        }
                    } catch (e) {
                        // If not JSON, treat as single file path
                        filePaths = [fieldValue];
                    }
                } else {
                    // Unknown type, try toString or ignore
                    console.warn(`Unknown type for field ${fieldName}:`, typeof fieldValue);
                }

                console.log(`[File Path Debug] Parsed paths:`, filePaths);

                // Add each file
                filePaths.forEach(filePath => {
                    if (filePath && typeof filePath === 'string' && filePath.trim() !== '') {
                        // Extract filename from path
                        const fileName = filePath.split('/').pop();

                        // Construct proper file URL
                        let fileUrl = filePath;

                        // If it's already a full URL, use it as is
                        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
                            // Full URL, use as is
                            console.log(`[File Path Debug] Full URL detected: "${fileUrl}"`);
                        } else {
                            // Remove leading slash if present
                            fileUrl = fileUrl.replace(/^\//, '');

                            // Use the same base path as the checklist code
                            // Client-uploaded files are stored in uploads/documents/client_documents/
                            fileUrl = `uploads/documents/client_documents/${fileUrl}`;

                            console.log(`[File Path Debug] Constructed path: "${filePath}" -> "${fileUrl}"`);
                        }

                        files.push({
                            name: fileName,
                            url: fileUrl,
                            upload_date: null, // Client uploads don't have timestamp in this field
                            file_size: null,
                            source: 'client_form' // Mark as coming from client form
                        });
                    }
                });
            }
        });

        console.log(`[File Path Debug] Total files found for category ${category}:`, files.length, files);

        return files;
    }

    // Helper function to format file size
    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    // Setup upload handlers for document categories
    function setupUploadHandlers() {
        // Quick upload button (direct file selection)
        $('.quick-upload-btn').off('click').on('click', function () {
            const category = $(this).data('category');
            $(`#quick-upload-${category}`).click();
        });

        // Handle quick upload file selection
        $('.quick-upload-input').off('change').on('change', function () {
            const category = $(this).data('category');
            const files = Array.from(this.files);

            if (files.length > 0) {
                handleQuickUpload(category, files);
            }

            // Reset input so same file can be selected again
            $(this).val('');
        });
    }

    // Handle quick upload without modal
    function handleQuickUpload(category, files) {
        const $progressContainer = $(`#quick-upload-progress-${category}`);
        const $progressBar = $progressContainer.find('.upload-progress-bar');
        const $statusText = $progressContainer.find('.upload-status-text');

        // Show progress
        $progressContainer.fadeIn();
        $statusText.html('<i class="fas fa-spinner fa-spin"></i> Uploading files...');
        $progressBar.css('width', '0%');

        let uploadedCount = 0;
        let failedCount = 0;
        const totalFiles = files.length;

        function uploadNextFile(index) {
            if (index >= totalFiles) {
                // All uploads complete
                if (failedCount === 0) {
                    $statusText.html('<i class="fas fa-check-circle" style="color: #10b981;"></i> All files uploaded successfully!');
                    $progressBar.css('width', '100%');
                } else {
                    $statusText.html(`<i class="fas fa-exclamation-circle" style="color: #f59e0b;"></i> ${uploadedCount} uploaded, ${failedCount} failed`);
                }

                setTimeout(() => {
                    $progressContainer.fadeOut();
                    // Reload documents view
                    loadClientDocuments();
                }, 2000);
                return;
            }

            const file = files[index];
            const formData = new FormData();
            formData.append('id', recordId);
            formData.append('type', recordType);
            formData.append('category', category);
            formData.append('file', file);

            // Update status
            $statusText.html(`<i class="fas fa-spinner fa-spin"></i> Uploading file ${index + 1} of ${totalFiles}: ${file.name}`);

            // Upload file
            $.ajax({
                url: 'api/documents.php?action=upload',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                xhr: function () {
                    const xhr = new window.XMLHttpRequest();
                    xhr.upload.addEventListener('progress', function (e) {
                        if (e.lengthComputable) {
                            const fileProgress = (e.loaded / e.total) * 100;
                            const totalProgress = ((index + (fileProgress / 100)) / totalFiles) * 100;
                            $progressBar.css('width', totalProgress + '%');
                        }
                    }, false);
                    return xhr;
                },
                success: function (response) {
                    if (response.status === 'success') {
                        uploadedCount++;
                    } else {
                        failedCount++;
                        console.error('Upload failed for file:', file.name, response.message);
                    }
                    // Upload next file
                    uploadNextFile(index + 1);
                },
                error: function (xhr, status, error) {
                    failedCount++;
                    console.error('Upload error for file:', file.name, error);
                    // Continue with next file even if this one failed
                    uploadNextFile(index + 1);
                }
            });
        }

        // Start uploading from first file
        uploadNextFile(0);
    }

    // Setup delete handlers for documents
    function setupDeleteHandlers() {
        $('.btn-delete-file').off('click').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const fileId = $(this).data('file-id');
            const fileName = $(this).data('file-name');
            const category = $(this).data('category');
            const isClientUpload = $(this).data('is-client') === true || $(this).data('is-client') === 'true';

            showDeleteConfirmModal(fileId, fileName, category, isClientUpload);
        });

        // Add hover effect
        $('.btn-delete-file').on('mouseenter', function () {
            $(this).css('background', '#dc2626');
        }).on('mouseleave', function () {
            $(this).css('background', '#ef4444');
        });
    }

    // Show delete confirmation modal
    function showDeleteConfirmModal(fileId, fileName, category, isClientUpload) {
        const warningText = isClientUpload
            ? 'This is a client-uploaded file. Deleting it will remove it from the client\'s form data.'
            : 'This file will be permanently deleted.';

        const modalHtml = `
            <div id="delete-confirm-backdrop" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: white; border-radius: 12px; max-width: 450px; width: 100%; padding: 30px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="width: 60px; height: 60px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 1.8rem; color: #ef4444;"></i>
                        </div>
                        <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.3rem;">Delete Document?</h4>
                        <p style="color: #64748b; margin: 0 0 10px 0;">${warningText}</p>
                        <p style="font-weight: 600; color: #ef4444; margin: 0; word-break: break-word;">${fileName}</p>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="delete-confirm-cancel" class="btn-secondary" style="flex: 1;">
                            Cancel
                        </button>
                        <button id="delete-confirm-ok" class="btn-primary danger" style="flex: 1; background: #ef4444;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        $('#delete-confirm-backdrop').remove();

        // Add modal to body
        $('body').append(modalHtml);

        // Handle cancel
        $('#delete-confirm-cancel').on('click', function () {
            $('#delete-confirm-backdrop').remove();
        });

        // Handle confirm delete
        $('#delete-confirm-ok').on('click', function () {
            if (isClientUpload) {
                deleteClientUploadedFile(fileName, category);
            } else {
                deleteDocument(fileId, fileName, category);
            }
        });

        // Close on backdrop click
        $('#delete-confirm-backdrop').on('click', function (e) {
            if (e.target === this) {
                $(this).remove();
            }
        });
    }

    // Delete client-uploaded file (removes from form data fields)
    function deleteClientUploadedFile(fileName, category) {
        // Show loading state
        $('#delete-confirm-ok').prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Deleting...');

        // Map category to field name
        const fieldMap = {
            'evisa': 'evisa_document_path',
            'share_code': 'share_code_document_path',
            'schengen_visa': 'schengen_visa_image',
            'bookings': 'booking_documents_path'
        };

        const fieldName = fieldMap[category];

        if (!fieldName) {
            alert('Error: Cannot delete this file type');
            $('#delete-confirm-backdrop').remove();
            return;
        }

        // Get current field value
        let currentValue = recordData.questions[fieldName];
        let filePaths = [];

        // Parse current value
        try {
            if (currentValue && currentValue.startsWith('[')) {
                filePaths = JSON.parse(currentValue);
            } else if (currentValue) {
                filePaths = [currentValue];
            }
        } catch (e) {
            filePaths = currentValue ? [currentValue] : [];
        }

        // Remove the file from the array
        filePaths = filePaths.filter(path => {
            const pathFileName = path.split('/').pop();
            return pathFileName !== fileName;
        });

        // Prepare new value
        const newValue = filePaths.length > 0 ? JSON.stringify(filePaths) : '';

        console.log('Deleting client file:', {
            fileName: fileName,
            category: category,
            fieldName: fieldName,
            currentValue: currentValue,
            newValue: newValue,
            recordId: recordId,
            recordType: recordType
        });

        // Update database - send the field update data
        const endpoint = recordType === 'traveler' ? 'api/travelers.php' : 'api/dependents.php';

        $.ajax({
            url: `${endpoint}?action=delete_file`,
            type: 'POST',
            data: {
                id: recordId,
                field_name: fieldName,
                file_name: fileName,
                new_value: newValue
            },
            dataType: 'json',
            success: function (response) {
                console.log('Delete response:', response);

                if (response.status === 'success') {
                    // Update local data
                    recordData.questions[fieldName] = newValue;

                    // Show success
                    $('#delete-confirm-backdrop').remove();

                    const notification = $(`
                        <div style="position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-check-circle"></i>
                            <span>File deleted successfully</span>
                        </div>
                    `);
                    $('body').append(notification);

                    setTimeout(() => {
                        notification.fadeOut(300, function () {
                            $(this).remove();
                        });
                    }, 3000);

                    // Reload documents view
                    loadClientDocuments();
                } else {
                    console.error('Delete failed:', response);
                    alert('Error: ' + (response.message || 'Failed to delete file'));
                    $('#delete-confirm-backdrop').remove();
                }
            },
            error: function (xhr, status, error) {
                console.error('Delete error:', {
                    status: status,
                    error: error,
                    responseText: xhr.responseText,
                    statusCode: xhr.status
                });

                // Try to parse error message
                let errorMsg = 'Server request failed';
                try {
                    const errorResponse = JSON.parse(xhr.responseText);
                    errorMsg = errorResponse.message || errorMsg;
                } catch (e) {
                    errorMsg = xhr.responseText || errorMsg;
                }

                alert('Error: ' + errorMsg + '\n\nNote: You need to add the delete_file action to your ' + endpoint + ' API file.');
                $('#delete-confirm-backdrop').remove();
            }
        });
    }

    // Delete document function
    function deleteDocument(fileId, fileName, category) {
        // Show loading state
        $('#delete-confirm-ok').prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Deleting...');

        $.ajax({
            url: 'api/documents.php?action=delete',
            type: 'POST',
            data: {
                id: recordId,
                type: recordType,
                file_id: fileId,
                category: category
            },
            dataType: 'json',
            success: function (response) {
                if (response.status === 'success') {
                    // Show success message
                    $('#delete-confirm-backdrop').remove();

                    // Show temporary success notification
                    const notification = $(`
                        <div style="position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-check-circle"></i>
                            <span>File deleted successfully</span>
                        </div>
                    `);
                    $('body').append(notification);

                    setTimeout(() => {
                        notification.fadeOut(300, function () {
                            $(this).remove();
                        });
                    }, 3000);

                    // Reload documents view
                    loadClientDocuments();
                } else {
                    alert('Error: ' + (response.message || 'Failed to delete file'));
                    $('#delete-confirm-backdrop').remove();
                }
            },
            error: function (xhr, status, error) {
                console.error('Delete error:', error);
                alert('Error: Failed to delete file. Please try again.');
                $('#delete-confirm-backdrop').remove();
            }
        });
    }

    // Show upload modal for a specific category
    function showUploadModal(category) {
        const categoryTitles = {
            'insurance': 'Insurance Documents',
            'flight': 'Flight Tickets',
            'application': 'Application Forms',
            'appointment': 'Appointment Confirmations',
            'hotel': 'Hotel Bookings',
            'evisa': 'E-Visa Documents',
            'share_code': 'Share Code Documents',
            'schengen_visa': 'Previous Schengen Visa',
            'bookings': 'Booking Documents'
        };

        const categoryDescriptions = {
            'insurance': 'Travel insurance certificates',
            'flight': 'Flight booking confirmations',
            'application': 'Visa application forms',
            'appointment': 'VFS/Consulate appointment confirmations',
            'hotel': 'Hotel reservation confirmations',
            'evisa': 'UK E-Visa screenshots or PDF documents',
            'share_code': 'UK immigration status share code documents',
            'schengen_visa': 'Previous Schengen visa images',
            'bookings': 'Travel booking confirmations'
        };

        const categoryTitle = categoryTitles[category] || 'Documents';
        const categoryDescription = categoryDescriptions[category] || 'Select one or more files to upload';

        // Create modal HTML with updated design
        const modalHtml = `
            <div id="upload-modal-backdrop" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div id="upload-modal-content" style="background: white; border-radius: 16px; max-width: 600px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
                    <!-- Modal Header -->
                    <div style="padding: 24px 30px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-upload" style="color: white; font-size: 1.1rem;"></i>
                            </div>
                            <h3 style="margin: 0; color: #1e293b; font-size: 1.25rem; font-weight: 600;">Upload ${categoryTitle}</h3>
                        </div>
                        <button id="upload-modal-close" style="background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
                            <i class="fas fa-times" style="color: #64748b; font-size: 1.1rem;"></i>
                        </button>
                    </div>
                    
                    <!-- Modal Body -->
                    <div style="padding: 30px; flex: 1; overflow-y: auto;">
                        <p style="color: #64748b; margin: 0 0 20px 0; font-size: 0.95rem;">
                            <i class="fas fa-info-circle"></i> ${categoryDescription}
                        </p>
                        
                        <div id="upload-drop-zone" style="border: 3px dashed #cbd5e1; border-radius: 12px; padding: 50px 20px; text-align: center; cursor: pointer; transition: all 0.3s; background: #f8fafc; margin-bottom: 20px;">
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                                    <i class="fas fa-cloud-upload-alt" style="font-size: 2.5rem; color: #2563eb;"></i>
                                </div>
                                <div>
                                    <p style="margin: 0 0 5px 0; color: #1e293b; font-weight: 600; font-size: 1rem;">Click to browse or drag files here</p>
                                    <p style="margin: 0; color: #64748b; font-size: 0.875rem;">Supported formats: PDF, JPG, PNG (Max 10MB per file)</p>
                                </div>
                            </div>
                        </div>
                        
                        <input type="file" id="upload-file-input" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
                        
                        <div id="upload-file-list" style="margin-bottom: 20px;"></div>
                        
                        <div id="upload-progress" style="display: none; margin-bottom: 20px;">
                            <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 10px;">
                                <div id="upload-progress-bar" style="background: linear-gradient(90deg, #2563eb 0%, #10b981 100%); height: 100%; width: 0%; transition: width 0.3s;"></div>
                            </div>
                            <p id="upload-progress-text" style="margin: 0; text-align: center; color: #64748b; font-size: 0.875rem;">Uploading...</p>
                        </div>
                    </div>
                    
                    <!-- Modal Footer -->
                    <div style="padding: 20px 30px; border-top: 1px solid #e2e8f0; display: flex; gap: 12px; justify-content: flex-end;">
                        <button id="upload-modal-cancel" class="btn-secondary" style="padding: 10px 20px;">
                            Cancel
                        </button>
                        <button id="upload-modal-confirm" class="btn-primary" style="padding: 10px 24px;" disabled>
                            <i class="fas fa-upload"></i> Upload Files
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        $('#upload-modal-backdrop').remove();

        // Add modal to body
        $('body').append(modalHtml);

        let selectedFiles = [];

        // Handle drop zone click
        $('#upload-drop-zone').on('click', function () {
            $('#upload-file-input').click();
        });

        // Handle drag and drop styling
        $('#upload-drop-zone').on('dragover', function (e) {
            e.preventDefault();
            $(this).css({
                'border-color': '#2563eb',
                'background': '#eff6ff'
            });
        });

        $('#upload-drop-zone').on('dragleave', function (e) {
            e.preventDefault();
            $(this).css({
                'border-color': '#cbd5e1',
                'background': '#f8fafc'
            });
        });

        $('#upload-drop-zone').on('drop', function (e) {
            e.preventDefault();
            $(this).css({
                'border-color': '#cbd5e1',
                'background': '#f8fafc'
            });

            const files = e.originalEvent.dataTransfer.files;
            handleFileSelection(files);
        });

        // Handle file input change
        $('#upload-file-input').on('change', function () {
            handleFileSelection(this.files);
        });

        // Handle file selection
        function handleFileSelection(files) {
            selectedFiles = Array.from(files);
            displaySelectedFiles();
            $('#upload-modal-confirm').prop('disabled', selectedFiles.length === 0);
        }

        // Display selected files
        function displaySelectedFiles() {
            if (selectedFiles.length === 0) {
                $('#upload-file-list').html('');
                return;
            }

            const listHtml = selectedFiles.map((file, index) => {
                const fileSize = formatFileSize(file.size);
                const fileExt = file.name.split('.').pop().toUpperCase();

                // Determine icon color based on file type
                let iconColor = '#2563eb';
                if (fileExt === 'PDF') iconColor = '#ef4444';
                else if (['JPG', 'JPEG', 'PNG'].includes(fileExt)) iconColor = '#10b981';

                return `
                    <div class="selected-file-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; transition: all 0.2s;">
                        <div style="width: 40px; height: 40px; background: white; border: 2px solid ${iconColor}; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <span style="color: ${iconColor}; font-weight: 700; font-size: 0.7rem;">${fileExt}</span>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <p style="margin: 0; font-weight: 600; color: #1e293b; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${file.name}</p>
                            <p style="margin: 0; color: #64748b; font-size: 0.8rem;">${fileSize}</p>
                        </div>
                        <button class="remove-file-btn" data-index="${index}" style="background: #fee2e2; color: #ef4444; border: none; border-radius: 6px; padding: 8px 12px; cursor: pointer; font-size: 0.85rem; transition: background 0.2s; flex-shrink: 0;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            }).join('');

            $('#upload-file-list').html(listHtml);

            // Handle remove file
            $('.remove-file-btn').on('click', function () {
                const index = $(this).data('index');
                selectedFiles.splice(index, 1);
                displaySelectedFiles();
                $('#upload-modal-confirm').prop('disabled', selectedFiles.length === 0);
            });

            // Add hover effects
            $('.remove-file-btn').on('mouseenter', function () {
                $(this).css('background', '#fecaca');
            }).on('mouseleave', function () {
                $(this).css('background', '#fee2e2');
            });

            $('.selected-file-item').on('mouseenter', function () {
                $(this).css('background', '#f1f5f9');
            }).on('mouseleave', function () {
                $(this).css('background', '#f8fafc');
            });
        }

        // Handle close button
        $('#upload-modal-close').on('click', function () {
            $('#upload-modal-backdrop').remove();
        });

        // Handle cancel
        $('#upload-modal-cancel').on('click', function () {
            $('#upload-modal-backdrop').remove();
        });

        // Close button hover effect
        $('#upload-modal-close').on('mouseenter', function () {
            $(this).css('background', '#e2e8f0');
        }).on('mouseleave', function () {
            $(this).css('background', '#f1f5f9');
        });

        // Handle upload
        $('#upload-modal-confirm').on('click', function () {
            if (selectedFiles.length === 0) return;

            // Disable buttons during upload
            $('#upload-modal-cancel').prop('disabled', true);
            $('#upload-modal-confirm').prop('disabled', true);
            $('#upload-progress').show();

            // Upload files one at a time
            let uploadedCount = 0;
            let failedCount = 0;
            const totalFiles = selectedFiles.length;

            function uploadNextFile(index) {
                if (index >= totalFiles) {
                    // All uploads complete
                    if (failedCount === 0) {
                        $('#upload-progress-text').html('<i class="fas fa-check-circle"></i> All files uploaded successfully!');
                    } else {
                        $('#upload-progress-text').html(`<i class="fas fa-exclamation-circle"></i> ${uploadedCount} uploaded, ${failedCount} failed`);
                    }

                    setTimeout(() => {
                        $('#upload-modal-backdrop').remove();
                        // Reload the documents view
                        loadClientDocuments();
                    }, 1500);
                    return;
                }

                const file = selectedFiles[index];
                const formData = new FormData();
                formData.append('id', recordId);
                formData.append('type', recordType);
                formData.append('category', category);
                formData.append('file', file); // Use 'file' not 'files[]'

                // Update progress text
                $('#upload-progress-text').text(`Uploading file ${index + 1} of ${totalFiles}...`);

                // Upload file
                $.ajax({
                    url: 'api/documents.php?action=upload', // Add action to URL
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false,
                    xhr: function () {
                        const xhr = new window.XMLHttpRequest();
                        xhr.upload.addEventListener('progress', function (e) {
                            if (e.lengthComputable) {
                                const fileProgress = (e.loaded / e.total) * 100;
                                const totalProgress = ((index + (fileProgress / 100)) / totalFiles) * 100;
                                $('#upload-progress-bar').css('width', totalProgress + '%');
                            }
                        }, false);
                        return xhr;
                    },
                    success: function (response) {
                        if (response.status === 'success') {
                            uploadedCount++;
                        } else {
                            failedCount++;
                            console.error('Upload failed for file:', file.name, response.message);
                        }
                        // Upload next file
                        uploadNextFile(index + 1);
                    },
                    error: function (xhr, status, error) {
                        failedCount++;
                        console.error('Upload error for file:', file.name, error);
                        // Continue with next file even if this one failed
                        uploadNextFile(index + 1);
                    }
                });
            }

            // Start uploading from first file
            uploadNextFile(0);
        });

        // Close on backdrop click
        $('#upload-modal-backdrop').on('click', function (e) {
            if (e.target === this) {
                $(this).remove();
            }
        });
    }


    // Function to load and check checklist items
    async function loadChecklistData() {
        const qData = recordData.questions || {};
        const occupationStatus = qData.occupation_status || '';
        const fingerprintsTaken = qData.fingerprints_taken || '';
        const hasCreditCard = qData.has_credit_card || '';

        // Check each item - some are async
        checkChecklistItem('passport', checkPassport());

        // UK E-Visa and Share Code checks (async)
        checkUKEvisa().then(result => {
            checkChecklistItem('uk-evisa', result);
            updateChecklistCounters();
            updateChecklistButtonStatus();
        });

        checkUKShareCode().then(result => {
            checkChecklistItem('uk-share-code', result);
            updateChecklistCounters();
            updateChecklistButtonStatus();
        });

        checkChecklistItem('evisa', checkEvisa());
        checkChecklistItem('photographs', checkPhotographs());

        // Conditional: Previous Schengen visa - only show if fingerprints were taken
        if (fingerprintsTaken === 'Yes') {
            $('.checklist-item[data-check="previous-schengen-visa"]').show();
            checkChecklistItem('previous-schengen-visa', checkPreviousSchengenVisa());
        } else {
            $('.checklist-item[data-check="previous-schengen-visa"]').hide();
        }

        checkChecklistItem('bank-statements', checkBankStatements());

        // Conditional: Credit card statement - only show if has credit card
        if (hasCreditCard === 'Yes') {
            $('.checklist-item[data-check="credit-card-statement"]').show();
            checkChecklistItem('credit-card-statement', checkCreditCardStatement());
        } else {
            $('.checklist-item[data-check="credit-card-statement"]').hide();
        }

        // Conditional items based on occupation
        if (occupationStatus === 'Employee') {
            // Show payslips and employment letter for employees
            $('.checklist-item[data-check="payslips"]').show();
            $('.checklist-item[data-check="employment"]').show();
            $('#employment-title').text('Employment Status Letter');
            $('#employment-description').text('Letter from employer confirming employment');
            checkChecklistItem('payslips', checkPayslips());
            checkChecklistItem('employment', checkEmploymentLetter());
        } else if (occupationStatus === 'Self-Employed / Freelancer') {
            // Hide payslips, show employment for tax/accountant letter
            $('.checklist-item[data-check="payslips"]').hide();
            $('.checklist-item[data-check="employment"]').show();
            $('#employment-title').text('Tax Return or Accountant Letter');
            $('#employment-description').text('Tax return statement or letter from accountant');
            checkChecklistItem('employment', checkSelfEmployedDocs());
        } else if (occupationStatus === 'Student') {
            // Hide payslips, show employment for student status letter
            $('.checklist-item[data-check="payslips"]').hide();
            $('.checklist-item[data-check="employment"]').show();
            $('#employment-title').text('School/University Status Letter');
            $('#employment-description').text('Letter confirming enrollment and approved leave');
            checkChecklistItem('employment', checkStudentStatusLetter());
        } else {
            // For other statuses (Retired, Unemployed, etc.), hide both
            $('.checklist-item[data-check="payslips"]').hide();
            $('.checklist-item[data-check="employment"]').hide();
        }

        // Check async items (API-uploaded documents)
        checkApplicationForm().then(result => {
            checkChecklistItem('application-form', result);
            updateChecklistCounters();
            updateChecklistButtonStatus();
        });

        checkInsurance().then(result => {
            checkChecklistItem('insurance', result);
            updateChecklistCounters();
            updateChecklistButtonStatus();
        });

        checkHotel().then(result => {
            checkChecklistItem('hotel', result);
            updateChecklistCounters();
            updateChecklistButtonStatus();
        });

        checkAppointment().then(result => {
            checkChecklistItem('appointment', result);
            updateChecklistCounters();
            updateChecklistButtonStatus();
        });

        checkFlight().then(result => {
            checkChecklistItem('flight', result);
            updateChecklistCounters();
            updateChecklistButtonStatus();
        });

        // Initial counter update
        updateChecklistCounters();
    }

    function updateChecklistCounters() {
        const completed = $('.checklist-item.completed').length;
        const total = $('.checklist-item').length;
        const pending = total - completed;

        $('#completed-count').text(completed);
        $('#pending-count').text(pending);
    }

    // NEW: Update checklist button status based on admin-uploaded documents
    function updateChecklistButtonStatus() {
        // Check if all 5 admin-uploaded document categories are complete
        const adminCategories = ['application-form', 'insurance', 'hotel', 'appointment', 'flight'];
        let allComplete = true;

        adminCategories.forEach(category => {
            const $item = $(`.checklist-item[data-check="${category}"]`);
            if (!$item.hasClass('completed')) {
                allComplete = false;
            }
        });

        // Update checklist button badge
        if (allComplete) {
            $(`.nav-item[data-action="checklist"]`).addClass('has-files');
        } else {
            $(`.nav-item[data-action="checklist"]`).removeClass('has-files');
        }
    }

    function checkChecklistItem(itemName, result) {
        const $item = $(`.checklist-item[data-check="${itemName}"]`);
        const $status = $item.find('.checklist-status');
        const $filesContainer = $item.find('.checklist-files');

        if (result.completed) {
            $item.addClass('completed');
            $status.html(`<i class="fas fa-check"></i> ${result.message}`).removeClass('pending missing');
        } else if (result.pending) {
            $item.removeClass('completed');
            $status.html(`<i class="fas fa-clock"></i> ${result.message}`).addClass('pending').removeClass('missing');
        } else {
            $item.removeClass('completed');
            $status.html(`<i class="fas fa-times"></i> ${result.message}`).addClass('missing').removeClass('pending');
        }

        // Add file links if available
        if (result.files && result.files.length > 0) {
            $filesContainer.empty();
            result.files.forEach((file, index) => {
                const fileName = file.name || file.split('/').pop();
                const fileUrl = file.url || file;
                const source = file.source || '';

                // Debug: Log the file URL being used
                console.log(`Checklist item ${itemName} - File ${index + 1}:`, {
                    fileName: fileName,
                    fileUrl: fileUrl,
                    source: source
                });

                // Create source badge if applicable
                let sourceBadge = '';
                if (source === 'Client Upload') {
                    sourceBadge = '<span class="file-source-badge client-upload"><i class="fas fa-user"></i> Client</span>';
                } else if (source === 'Admin Upload') {
                    sourceBadge = '<span class="file-source-badge admin-upload"><i class="fas fa-shield-alt"></i> Admin</span>';
                }

                const $link = $(`
                    <a href="${fileUrl}" target="_blank" class="checklist-file-link" data-file-url="${fileUrl}" data-file-name="${fileName}">
                        <i class="fas fa-file-alt"></i>
                        <span class="file-name">${fileName}</span>
                        ${sourceBadge}
                        <span class="file-badge">View</span>
                    </a>
                `);
                $filesContainer.append($link);
            });

            // Attach hover preview handlers
            attachFilePreviewHandlers();
        }
    }

    // File Preview on Hover
    let previewTimeout;
    let currentPreviewUrl = null;

    function attachFilePreviewHandlers() {
        $('.checklist-file-link').off('mouseenter mouseleave mousemove');

        $('.checklist-file-link').on('mouseenter', function (e) {
            const $link = $(this);
            const fileUrl = $link.data('file-url');
            const fileName = $link.data('file-name');

            // Clear any existing timeout
            clearTimeout(previewTimeout);

            // Set a delay before showing preview
            previewTimeout = setTimeout(() => {
                showFilePreview(fileUrl, fileName, e);
            }, 500); // 500ms delay
        });

        $('.checklist-file-link').on('mouseleave', function () {
            clearTimeout(previewTimeout);
            hideFilePreview();
        });

        $('.checklist-file-link').on('mousemove', function (e) {
            updatePreviewPosition(e);
        });
    }

    function showFilePreview(fileUrl, fileName, event) {
        const $tooltip = $('#file-preview-tooltip');
        const $content = $('#preview-content');
        const $filename = $('#preview-filename');

        // Set filename
        $filename.text(fileName);

        // Show loading state
        $content.html('<div class="file-preview-loading"><i class="fas fa-spinner"></i></div>');

        // Determine file type
        const extension = fileName.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension);
        const isPDF = extension === 'pdf';

        if (isImage) {
            // Preview image
            const img = new Image();
            img.onload = function () {
                $content.html(`<img src="${fileUrl}" alt="${fileName}">`);
            };
            img.onerror = function () {
                $content.html('<div class="file-preview-error"><i class="fas fa-exclamation-triangle"></i><p>Unable to load preview</p></div>');
            };
            img.src = fileUrl;
        } else if (isPDF) {
            // Preview PDF
            $content.html(`<iframe src="${fileUrl}#view=FitH" type="application/pdf"></iframe>`);
        } else {
            // Unsupported file type
            $content.html('<div class="file-preview-error"><i class="fas fa-file"></i><p>Preview not available for this file type</p></div>');
        }

        // Position and show tooltip
        updatePreviewPosition(event);
        currentPreviewUrl = fileUrl;

        setTimeout(() => {
            $tooltip.addClass('show');
        }, 100);
    }

    function hideFilePreview() {
        const $tooltip = $('#file-preview-tooltip');
        $tooltip.removeClass('show');
        currentPreviewUrl = null;

        // Clear content after fade out
        setTimeout(() => {
            if (!currentPreviewUrl) {
                $('#preview-content').html('<div class="file-preview-loading"><i class="fas fa-spinner"></i></div>');
            }
        }, 300);
    }

    function updatePreviewPosition(event) {
        const $tooltip = $('#file-preview-tooltip');
        const tooltipWidth = $tooltip.outerWidth();
        const tooltipHeight = $tooltip.outerHeight();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const scrollTop = $(window).scrollTop();
        const scrollLeft = $(window).scrollLeft();

        let left = event.pageX + 20;
        let top = event.pageY + 20;

        // Adjust if tooltip goes off right edge
        if (left + tooltipWidth > windowWidth + scrollLeft) {
            left = event.pageX - tooltipWidth - 20;
        }

        // Adjust if tooltip goes off bottom edge
        if (top + tooltipHeight > windowHeight + scrollTop) {
            top = event.pageY - tooltipHeight - 20;
        }

        // Ensure tooltip doesn't go off top or left edge
        if (top < scrollTop + 10) {
            top = scrollTop + 10;
        }
        if (left < scrollLeft + 10) {
            left = scrollLeft + 10;
        }

        $tooltip.css({
            left: left + 'px',
            top: top + 'px'
        });
    }

    /**
     * Helper to resolve file URLs for both legacy and new folder structures
     */
    function resolveFileUrl(file) {
        if (!file) return '#';
        // If it's already a full URL or absolute path, return it
        if (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('/')) {
            return file;
        }

        // Remove leading slash if present to avoid double slashes
        const cleanFile = file.replace(/^\//, '');

        // Both legacy flat files and new nested (2025/01/...) files reside in client_documents
        return `uploads/documents/client_documents/${cleanFile}`;
    }

    // Individual check functions
    function checkApplicationForm() {
        // Check if application form documents exist
        return new Promise((resolve) => {
            $.get(`api/documents.php?action=get_documents&id=${recordId}&type=${recordType}&category=application`, function (res) {
                if (res.status === 'success' && res.documents && res.documents.length > 0) {
                    const files = res.documents.map(doc => {
                        // API already formats the URL with web path
                        let fileUrl = doc.url || doc.file_path;
                        // If path doesn't start with http/https or /, make it relative to current domain
                        if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('/')) {
                            fileUrl = '/' + fileUrl;
                        }
                        return {
                            name: doc.original_filename || doc.name || doc.filename,
                            url: fileUrl
                        };
                    });
                    resolve({
                        completed: true,
                        message: `Uploaded (${res.documents.length} file${res.documents.length > 1 ? 's' : ''})`,
                        files: files
                    });
                } else {
                    resolve({ completed: false, pending: true, message: 'Not yet uploaded' });
                }
            }, 'json').fail(() => {
                resolve({ completed: false, pending: true, message: 'Not yet uploaded' });
            });
        });
    }

    function checkUKEvisa() {
        // Check if UK E-Visa documents exist from BOTH sources:
        // 1. Client-uploaded files (evisa_document_path field)
        // 2. Admin-uploaded files (Documents section - evisa category)

        return new Promise((resolve) => {
            const qData = recordData.questions || {};
            let allFiles = [];

            // Helper to safe-get property from flat recordData or nested questions
            const getField = (key) => recordData[key] || qData[key];

            // 1. Check for Spring Boot "Link" arrays (evisaDocumentLinks OR evisa_document_links)
            // The app converts camelCase to snake_case, so we must check both.
            const links = getField('evisaDocumentLinks') || getField('evisa_document_links');

            if (links && Array.isArray(links)) {
                links.forEach(link => {
                    allFiles.push({
                        name: link.split('file=').pop().split('/').pop(),
                        url: link,
                        source: 'Client Upload'
                    });
                });
            }

            // 2. Check for JSON strings (evisa_document_path OR evisaDocument OR evisa_document)
            if (allFiles.length === 0) {
                let rawJson = qData.evisa_document_path || recordData.evisaDocument || recordData.evisa_document;

                if (typeof rawJson === 'string' && rawJson) {
                    try {
                        let parsed = JSON.parse(rawJson);
                        if (Array.isArray(parsed)) {
                            parsed.forEach(file => {
                                allFiles.push({
                                    name: file.split('/').pop(),
                                    url: resolveFileUrl(file),
                                    source: 'Client Upload'
                                });
                            });
                        }
                    } catch (e) {
                        console.error("Error parsing evisa files", e);
                    }
                }
            }

            // Then, check admin-uploaded files from Documents section
            $.get(`api/documents.php?action=get_documents&id=${recordId}&type=${recordType}&category=evisa`, function (res) {
                if (res.status === 'success' && res.documents && res.documents.length > 0) {
                    res.documents.forEach(doc => {
                        let fileUrl = doc.url || doc.file_path;
                        if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('/')) {
                            fileUrl = '/' + fileUrl;
                        }
                        allFiles.push({
                            name: doc.original_filename || doc.name || doc.filename || 'E-Visa Document',
                            url: fileUrl,
                            source: 'Admin Upload'
                        });
                    });
                }

                // Return result
                if (allFiles.length > 0) {
                    resolve({
                        completed: true,
                        message: `${allFiles.length} file${allFiles.length > 1 ? 's' : ''} uploaded`,
                        files: allFiles
                    });
                } else {
                    resolve({ completed: false, pending: true, message: 'Not applicable / Not uploaded' });
                }
            }, 'json').fail(() => {
                // If API call fails, still return client files if any
                if (allFiles.length > 0) {
                    resolve({
                        completed: true,
                        message: `${allFiles.length} file${allFiles.length > 1 ? 's' : ''} uploaded`,
                        files: allFiles
                    });
                } else {
                    resolve({ completed: false, pending: true, message: 'Not applicable / Not uploaded' });
                }
            });
        });
    }

    function checkUKShareCode() {
        // Check if UK Share Code documents exist from BOTH sources:
        // 1. Client-uploaded files (share_code_document_path field)
        // 2. Admin-uploaded files (Documents section - share_code category)

        return new Promise((resolve) => {
            const qData = recordData.questions || {};
            let allFiles = [];

            // Helper to safe-get property from flat recordData or nested questions
            const getField = (key) => recordData[key] || qData[key];

            // 1. Check for Spring Boot "Link" arrays
            const links = getField('shareCodeDocumentLinks') || getField('share_code_document_links');

            if (links && Array.isArray(links)) {
                links.forEach(link => {
                    allFiles.push({
                        name: link.split('file=').pop().split('/').pop(),
                        url: link,
                        source: 'Client Upload'
                    });
                });
            }
            // 2. Check for Legacy PHP JSON strings
            if (allFiles.length === 0) {
                let rawJson = qData.share_code_document_path || recordData.shareCodeDocument || recordData.share_code_document;
                if (typeof rawJson === 'string' && rawJson) {
                    try {
                        let parsed = JSON.parse(rawJson);
                        if (Array.isArray(parsed)) {
                            parsed.forEach(file => {
                                allFiles.push({
                                    name: file.split('/').pop(),
                                    url: resolveFileUrl(file),
                                    source: 'Client Upload'
                                });
                            });
                        }
                    } catch (e) {
                        console.error("Error parsing share code files", e);
                    }
                }
            }

            // Then, check admin-uploaded files from Documents section
            $.get(`api/documents.php?action=get_documents&id=${recordId}&type=${recordType}&category=share_code`, function (res) {
                if (res.status === 'success' && res.documents && res.documents.length > 0) {
                    res.documents.forEach(doc => {
                        let fileUrl = doc.url || doc.file_path;
                        if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('/')) {
                            fileUrl = '/' + fileUrl;
                        }
                        allFiles.push({
                            name: doc.original_filename || doc.name || doc.filename || 'Share Code Document',
                            url: fileUrl,
                            source: 'Admin Upload'
                        });
                    });
                }

                // Return result
                if (allFiles.length > 0) {
                    resolve({
                        completed: true,
                        message: `${allFiles.length} file${allFiles.length > 1 ? 's' : ''} uploaded`,
                        files: allFiles
                    });
                } else {
                    resolve({ completed: false, pending: true, message: 'Not applicable / Not uploaded' });
                }
            }, 'json').fail(() => {
                // If API call fails, still return client files if any
                if (allFiles.length > 0) {
                    resolve({
                        completed: true,
                        message: `${allFiles.length} file${allFiles.length > 1 ? 's' : ''} uploaded`,
                        files: allFiles
                    });
                } else {
                    resolve({ completed: false, pending: true, message: 'Not applicable / Not uploaded' });
                }
            });
        });
    }

    function checkPassport() {
        const qData = recordData.questions || {};
        const pData = recordData.personal || {};

        if (pData.passport_number && pData.passport_expiry) {
            return { completed: true, message: `Passport #${pData.passport_number}` };
        }
        return { completed: false, missing: true, message: 'Missing passport information' };
    }

    function checkEvisa() {
        const qData = recordData.questions || {};
        let evisaFiles = qData.evisa_document_path || qData.share_code_document_path;

        if (typeof evisaFiles === 'string') {
            try { evisaFiles = JSON.parse(evisaFiles); } catch (e) { evisaFiles = []; }
        }

        if (Array.isArray(evisaFiles) && evisaFiles.length > 0) {
            const files = evisaFiles.map(file => {
                let fileUrl = file;
                // Add base path for client documents if not already a full URL
                if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('/api/')) {
                    // Remove leading slash if present
                    fileUrl = fileUrl.replace(/^\//, '');
                    // Add the base path for client documents
                    fileUrl = `uploads/documents/client_documents/${fileUrl}`;
                }
                return {
                    name: file.split('/').pop(),
                    url: fileUrl
                };
            });
            return {
                completed: true,
                message: `Client uploaded (${evisaFiles.length} file${evisaFiles.length > 1 ? 's' : ''})`,
                files: files
            };
        }
        return { completed: false, pending: true, message: 'Client needs to upload' };
    }

    function checkPhotographs() {
        const qData = recordData.questions || {};
        let photoFiles = qData.schengen_visa_image;

        if (typeof photoFiles === 'string') {
            try { photoFiles = JSON.parse(photoFiles); } catch (e) { photoFiles = []; }
        }

        if (Array.isArray(photoFiles) && photoFiles.length > 0) {
            const files = photoFiles.map((file, idx) => {
                let fileUrl = file;
                // Add base path for client documents if not already a full URL
                if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
                    // Remove leading slash if present
                    fileUrl = fileUrl.replace(/^\//, '');
                    // Add the base path for client documents
                    fileUrl = `uploads/documents/client_documents/${fileUrl}`;
                }
                return {
                    name: `Passport Photo ${idx + 1}`,
                    url: fileUrl
                };
            });
            return {
                completed: true,
                message: `Client uploaded (${photoFiles.length} photo${photoFiles.length > 1 ? 's' : ''})`,
                files: files
            };
        }
        return { completed: false, pending: true, message: 'Client needs to upload' };
    }

    function checkPreviousSchengenVisa() {
        const qData = recordData.questions || {};
        // Helper to safe-get property from flat recordData or nested questions
        const getField = (key) => recordData[key] || qData[key];

        // This function is only called when fingerprints_taken === 'Yes'
        // Check if visa image was uploaded
        let visaFiles = [];

        // 1. Check Spring Boot Links
        const links = getField('schengenVisaImageLinks') || getField('schengen_visa_image_links');
        if (links && Array.isArray(links)) {
            visaFiles = links.map((link, idx) => ({
                name: `Previous Schengen Visa ${idx + 1}`,
                url: link
            }));
        } else {
            // 2. Legacy Check
            let rawFiles = getField('schengen_visa_image') || getField('schengenVisaImage');
            if (typeof rawFiles === 'string' && rawFiles) {
                try { rawFiles = JSON.parse(rawFiles); } catch (e) { rawFiles = []; }
            }
            if (Array.isArray(rawFiles) && rawFiles.length > 0) {
                visaFiles = rawFiles.map((file, idx) => ({
                    name: `Previous Schengen Visa ${idx + 1}`,
                    url: resolveFileUrl(file)
                }));
            }
        }

        if (visaFiles.length > 0) {
            return {
                completed: true,
                message: `Client uploaded (${visaFiles.length} file${visaFiles.length > 1 ? 's' : ''})`,
                files: visaFiles
            };
        }

        return { completed: false, pending: true, message: 'Client needs to upload previous Schengen visa' };
    }

    function checkBankStatements() {
        const qData = recordData.questions || {};
        let bankDocs = [];

        // 1. Spring Boot Links (bookingDocumentLinks)
        if (recordData.bookingDocumentLinks && Array.isArray(recordData.bookingDocumentLinks)) {
            bankDocs = recordData.bookingDocumentLinks.filter(link => {
                const lowerLink = link.toLowerCase();
                return lowerLink.includes('bank') || lowerLink.includes('statement');
            }).map(link => ({
                name: link.split('file=').pop().split('/').pop(),
                url: link
            }));
        }

        // 2. Legacy Check if no Spring Boot links found or mixed usage
        if (bankDocs.length === 0) {
            let bankFiles = qData.booking_documents_path || recordData.bookingDocument;
            if (typeof bankFiles === 'string') {
                try { bankFiles = JSON.parse(bankFiles); } catch (e) { bankFiles = []; }
            }

            if (Array.isArray(bankFiles) && bankFiles.length > 0) {
                const rawBankDocs = bankFiles.filter(f => f.toLowerCase().includes('bank') || f.toLowerCase().includes('statement'));
                bankDocs = rawBankDocs.map(file => ({
                    name: file.split('/').pop(),
                    url: resolveFileUrl(file)
                }));
            }
        }

        if (bankDocs.length > 0) {
            return {
                completed: true,
                message: `Client uploaded (${bankDocs.length} file${bankDocs.length > 1 ? 's' : ''})`,
                files: bankDocs
            };
        }
        return { completed: false, pending: true, message: 'Client needs to upload' };
    }

    function checkCreditCardStatement() {
        return checkBookingDocs(
            ['credit', 'card', 'cc'],
            'Client needs to upload credit card statement'
        );
    }

    function checkPayslips() {
        return checkBookingDocs(
            ['payslip', 'salary'],
            'Client needs to upload'
        );
    }

    function checkEmploymentLetter() {
        return checkBookingDocs(
            ['employment', 'letter', 'leave', 'noc'],
            'Client needs to upload employment letter'
        );
    }

    function checkSelfEmployedDocs() {
        return checkBookingDocs(
            ['tax', 'accountant', 'return', 'self'],
            'Client needs to upload tax return/accountant letter'
        );
    }

    function checkStudentStatusLetter() {
        return checkBookingDocs(
            ['student', 'school', 'university', 'enrollment'],
            'Client needs to upload student status letter'
        );
    }

    /**
     * Generic helper for all checks that rely on booking_documents_path/bookingDocumentLinks
     */
    function checkBookingDocs(keywords, missingMessage) {
        const qData = recordData.questions || {};
        let matchedDocs = [];

        // Helper to safe-get property (flat or nested)
        const getField = (key) => recordData[key] || qData[key];

        // 1. Spring Boot Links (bookingDocumentLinks OR booking_document_links)
        const links = getField('bookingDocumentLinks') || getField('booking_document_links');

        if (links && Array.isArray(links)) {
            matchedDocs = links.filter(link => {
                const lower = link.toLowerCase();
                return keywords.some(k => lower.includes(k));
            }).map(link => ({
                name: link.split('file=').pop().split('/').pop(),
                url: link
            }));
        }

        // 2. Legacy / Fallback
        if (matchedDocs.length === 0) {
            let bookingFiles = getField('booking_documents_path') || getField('bookingDocument') || getField('booking_document');

            if (typeof bookingFiles === 'string' && bookingFiles) {
                try { bookingFiles = JSON.parse(bookingFiles); } catch (e) { bookingFiles = []; }
            }

            if (Array.isArray(bookingFiles) && bookingFiles.length > 0) {
                const rawDocs = bookingFiles.filter(f => {
                    const lower = f.toLowerCase();
                    return keywords.some(k => lower.includes(k));
                });
                matchedDocs = rawDocs.map(file => ({
                    name: file.split('/').pop(),
                    url: resolveFileUrl(file)
                }));
            }
        }

        if (matchedDocs.length > 0) {
            return {
                completed: true,
                message: `Client uploaded (${matchedDocs.length} file${matchedDocs.length > 1 ? 's' : ''})`,
                files: matchedDocs
            };
        }
        return { completed: false, pending: true, message: missingMessage };
    }

    function checkStudentStatusLetter() {
        const qData = recordData.questions || {};
        let bookingFiles = qData.booking_documents_path;

        if (typeof bookingFiles === 'string') {
            try { bookingFiles = JSON.parse(bookingFiles); } catch (e) { bookingFiles = []; }
        }

        if (Array.isArray(bookingFiles) && bookingFiles.length > 0) {
            const studentDocs = bookingFiles.filter(f => f.toLowerCase().includes('student') || f.toLowerCase().includes('school') || f.toLowerCase().includes('university') || f.toLowerCase().includes('enrollment'));
            if (studentDocs.length > 0) {
                const files = studentDocs.map(file => {
                    let fileUrl = file;
                    // Add base path for client documents if not already a full URL
                    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
                        fileUrl = fileUrl.replace(/^\//, '');
                        fileUrl = `uploads/documents/client_documents/${fileUrl}`;
                    }
                    return {
                        name: file.split('/').pop(),
                        url: fileUrl
                    };
                });
                return {
                    completed: true,
                    message: `Client uploaded (${studentDocs.length} file${studentDocs.length > 1 ? 's' : ''})`,
                    files: files
                };
            }
        }
        return { completed: false, pending: true, message: 'Client needs to upload student status letter' };
    }

    function checkInsurance() {
        return new Promise((resolve) => {
            $.get(`api/documents.php?action=get_documents&id=${recordId}&type=${recordType}&category=insurance`, function (res) {
                if (res.status === 'success' && res.documents && res.documents.length > 0) {
                    const files = res.documents.map(doc => {
                        // API already formats the URL with web path
                        let fileUrl = doc.url || doc.file_path;
                        // If path doesn't start with http/https or /, make it relative to current domain
                        if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('/')) {
                            fileUrl = '/' + fileUrl;
                        }
                        return {
                            name: doc.original_filename || doc.name || doc.filename,
                            url: fileUrl
                        };
                    });
                    resolve({
                        completed: true,
                        message: `Uploaded (${res.documents.length} file${res.documents.length > 1 ? 's' : ''})`,
                        files: files
                    });
                } else {
                    resolve({ completed: false, pending: true, message: 'Not yet uploaded' });
                }
            }, 'json').fail(() => {
                resolve({ completed: false, pending: true, message: 'Not yet uploaded' });
            });
        });
    }

    function checkHotel() {
        return new Promise((resolve) => {
            $.get(`api/documents.php?action=get_documents&id=${recordId}&type=${recordType}&category=hotel`, function (res) {
                if (res.status === 'success' && res.documents && res.documents.length > 0) {
                    const files = res.documents.map(doc => {
                        // API already formats the URL with web path
                        let fileUrl = doc.url || doc.file_path;
                        // If path doesn't start with http/https or /, make it relative to current domain
                        if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('/')) {
                            fileUrl = '/' + fileUrl;
                        }
                        return {
                            name: doc.original_filename || doc.name || doc.filename,
                            url: fileUrl
                        };
                    });
                    resolve({
                        completed: true,
                        message: `Uploaded (${res.documents.length} file${res.documents.length > 1 ? 's' : ''})`,
                        files: files
                    });
                } else {
                    resolve({ completed: false, pending: true, message: 'Not yet uploaded' });
                }
            }, 'json').fail(() => {
                resolve({ completed: false, pending: true, message: 'Not yet uploaded' });
            });
        });
    }

    function checkFlight() {
        return new Promise((resolve) => {
            $.get(`api/documents.php?action=get_documents&id=${recordId}&type=${recordType}&category=flight`, function (res) {
                if (res.status === 'success' && res.documents && res.documents.length > 0) {
                    const files = res.documents.map(doc => {
                        // API already formats the URL with web path
                        let fileUrl = doc.url || doc.file_path;
                        // If path doesn't start with http/https or /, make it relative to current domain
                        if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('/')) {
                            fileUrl = '/' + fileUrl;
                        }
                        return {
                            name: doc.original_filename || doc.name || doc.filename,
                            url: fileUrl
                        };
                    });
                    resolve({
                        completed: true,
                        message: `Uploaded (${res.documents.length} file${res.documents.length > 1 ? 's' : ''})`,
                        files: files
                    });
                } else {
                    resolve({ completed: false, pending: true, message: 'Not yet uploaded' });
                }
            }, 'json').fail(() => {
                resolve({ completed: false, pending: true, message: 'Not yet uploaded' });
            });
        });
    }

    function checkAppointment() {
        return new Promise((resolve) => {
            $.get(`api/documents.php?action=get_documents&id=${recordId}&type=${recordType}&category=appointment`, function (res) {
                if (res.status === 'success' && res.documents && res.documents.length > 0) {
                    const files = res.documents.map(doc => {
                        // API already formats the URL with web path
                        let fileUrl = doc.url || doc.file_path;
                        // If path doesn't start with http/https or /, make it relative to current domain
                        if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('/')) {
                            fileUrl = '/' + fileUrl;
                        }
                        return {
                            name: doc.original_filename || doc.name || doc.filename,
                            url: fileUrl
                        };
                    });
                    resolve({
                        completed: true,
                        message: `Uploaded (${res.documents.length} file${res.documents.length > 1 ? 's' : ''})`,
                        files: files
                    });
                } else {
                    resolve({ completed: false, pending: true, message: 'Not yet uploaded' });
                }
            }, 'json').fail(() => {
                resolve({ completed: false, pending: true, message: 'Not yet uploaded' });
            });
        });
    }

    // FILE PREVIEW FUNCTIONALITY
    function setupFilePreview() {
        // Create modal if it doesn't exist
        if ($('#file-preview-modal').length === 0) {
            const modal = $(`
                <div id="file-preview-modal" class="file-preview-modal">
                    <div class="file-preview-container">
                        <div class="file-preview-header">
                            <h3 class="file-preview-title"></h3>
                            <button class="file-preview-close" aria-label="Close">&times;</button>
                        </div>
                        <div class="file-preview-content">
                            <div class="file-preview-loading">
                                <i class="fas fa-spinner"></i>
                                <p>Loading...</p>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            $('body').append(modal);
        }

        // Handle file link clicks
        $(document).on('click', 'a[href*=".pdf"], a[href*=".jpg"], a[href*=".jpeg"], a[href*=".png"], a[href*=".gif"], a[href*=".webp"]', function (e) {
            const href = $(this).attr('href');

            // Check if it's a file we can preview
            if (href && (href.includes('.pdf') || href.match(/\.(jpg|jpeg|png|gif|webp)$/i))) {
                e.preventDefault();
                const fileName = $(this).text().trim() || 'Document';
                const fileUrl = href;

                openFilePreview(fileName, fileUrl);
            }
        });

        // Close modal handlers
        $(document).on('click', '.file-preview-close', closeFilePreview);
        $(document).on('click', '.file-preview-modal', function (e) {
            if ($(e.target).hasClass('file-preview-modal')) {
                closeFilePreview();
            }
        });

        // ESC key to close
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape' && $('#file-preview-modal').hasClass('active')) {
                closeFilePreview();
            }
        });
    }

    function openFilePreview(fileName, fileUrl) {
        const modal = $('#file-preview-modal');
        const content = modal.find('.file-preview-content');
        const title = modal.find('.file-preview-title');

        // Set title
        title.text(fileName);

        // Show loading
        content.html(`
            <div class="file-preview-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading...</p>
            </div>
        `);

        // Show modal
        modal.addClass('active');
        $('body').css('overflow', 'hidden');

        // Determine file type and load content
        const fileExtension = fileUrl.split('.').pop().toLowerCase();

        if (fileExtension === 'pdf') {
            // PDF Preview - responsive iframe
            content.html(`
                <div class="file-preview-pdf-container">
                    <iframe src="${fileUrl}#view=FitH" type="application/pdf" allowfullscreen></iframe>
                </div>
            `);
        } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) {
            // Image Preview - responsive with zoom controls
            const img = new Image();
            img.onload = function () {
                content.html(`
                    <div class="file-preview-image-container">
                        <div class="image-controls">
                            <button class="image-control-btn zoom-in" title="Zoom In">
                                <i class="fas fa-search-plus"></i>
                            </button>
                            <button class="image-control-btn zoom-out" title="Zoom Out">
                                <i class="fas fa-search-minus"></i>
                            </button>
                            <button class="image-control-btn zoom-reset" title="Reset Zoom">
                                <i class="fas fa-expand"></i>
                            </button>
                        </div>
                        <div class="image-wrapper">
                            <img src="${fileUrl}" alt="${fileName}" class="preview-image">
                        </div>
                    </div>
                `);

                // Add zoom functionality
                let scale = 1;
                const $img = content.find('.preview-image');

                content.find('.zoom-in').on('click', function () {
                    scale = Math.min(scale + 0.25, 3);
                    $img.css('transform', `scale(${scale})`);
                });

                content.find('.zoom-out').on('click', function () {
                    scale = Math.max(scale - 0.25, 0.5);
                    $img.css('transform', `scale(${scale})`);
                });

                content.find('.zoom-reset').on('click', function () {
                    scale = 1;
                    $img.css('transform', 'scale(1)');
                });
            };
            img.onerror = function () {
                content.html(`
                    <div class="file-preview-loading">
                        <i class="fas fa-exclamation-triangle" style="color: #ef4444; font-size: 3rem;"></i>
                        <p style="margin-top: 15px;">Failed to load image</p>
                        <a href="${fileUrl}" target="_blank" class="btn-primary" style="margin-top: 20px;">
                            <i class="fas fa-external-link-alt"></i> Open in New Tab
                        </a>
                    </div>
                `);
            };
            img.src = fileUrl;
        } else {
            // Unsupported file type
            content.html(`
                <div class="file-preview-loading">
                    <i class="fas fa-file" style="color: #64748b; font-size: 3rem;"></i>
                    <p style="margin-top: 15px;">Preview not available for this file type</p>
                    <a href="${fileUrl}" target="_blank" class="btn-primary" style="margin-top: 20px;">
                        <i class="fas fa-external-link-alt"></i> Open in New Tab
                    </a>
                </div>
            `);
        }
    }

    function closeFilePreview() {
        const modal = $('#file-preview-modal');
        modal.removeClass('active');
        $('body').css('overflow', '');

        // Clear content after animation
        setTimeout(() => {
            modal.find('.file-preview-content').html('');
        }, 300);
    }

    // Sticky header scroll effect
    // Sticky header scroll effect - Optimized
    // Sticky header scroll effect - REMOVED for performance (CSS handles sticky position)
    /*
    function setupStickyHeader() {
        const $nav = $('.horizontal-nav');
        let ticking = false;

        $(window).on('scroll', function () {
            if (!ticking) {
                window.requestAnimationFrame(function () {
                    const currentScroll = $(window).scrollTop();
                    if (currentScroll > 10) {
                        $nav.addClass('scrolled');
                    } else {
                        $nav.removeClass('scrolled');
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });
    }
    */

    // Initialize file preview on document ready
    setupFilePreview();

    // Initialize sticky header
    // Initialize sticky header
    // setupStickyHeader();
});
console.log('Form data viewer script loaded');
/**
 * ========================================================================
 * PORTUGAL PDF GENERATOR - COMPLETE INTEGRATION CODE
 * ========================================================================
 * 
 * INSTRUCTIONS:
 * 1. Copy this ENTIRE file content
 * 2. Paste at the END of your form_data_viewer.js file
 * 3. That's it! The button will work automatically
 * 
 * The code will:
 * - Add click handler to the navigation button
 * - Generate PDF from current traveler/dependent
 * - Download filled PDF automatically
 * ========================================================================
 */

// ========================================================================
// CORE PDF GENERATION FUNCTION
// ========================================================================

// ========================================================================
// TEST FUNCTION - PORTUGAL PDF API HEALTH CHECK
// ========================================================================

function generateAustriaPDF(recordId, recordType) {
    console.log('🔄 Generating Austria PDF with user data...');
    console.log('Record ID:', recordId, 'Type:', recordType);

    if (typeof window.recordData === 'undefined' || !window.recordData) {
        alert('⚠️ Error: User data not loaded yet.\n\nPlease wait for the page to fully load and try again.');
        console.error('window.recordData is not defined or empty');
        return;
    }

    const pData = window.recordData.personal || {};
    const qData = window.recordData.questions || {};

    console.log('📋 recordData found:', window.recordData);
    console.log('📋 personal data:', pData);

    if (Object.keys(pData).length === 0) {
        alert('⚠️ Error: Personal data is empty.\n\nThe page may still be loading. Please wait a moment and try again.');
        console.error('Personal data object is empty');
        return;
    }

    const firstName = pData.first_name || '';
    const lastName = pData.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'N/A';
    const passportNumber = pData.passport_no || 'N/A';
    const dateOfBirth = pData.dob || 'N/A';

    let formattedDOB = dateOfBirth;
    if (dateOfBirth && dateOfBirth !== '0000-00-00') {
        const dobParts = dateOfBirth.split('-');
        if (dobParts.length === 3) {
            formattedDOB = `${dobParts[2]}/${dobParts[1]}/${dobParts[0]}`;
        }
    }

    console.log('📋 User Data Extracted:', {
        fullName,
        passportNumber,
        dateOfBirth: formattedDOB
    });

    const travelCountryRaw = pData.travel_country || qData.travel_country || DEFAULT_TRAVEL_COUNTRY;
    const travelCountry = (travelCountryRaw || DEFAULT_TRAVEL_COUNTRY).trim() || DEFAULT_TRAVEL_COUNTRY;

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'pdf-generation-loading';
    loadingDiv.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: white; padding: 40px; border-radius: 15px; text-align: center;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 10000; min-width: 450px;">
            <i class="fas fa-file-pdf" style="font-size: 60px; color: #e74c3c; margin-bottom: 20px;"></i>
            <h3 style="margin: 15px 0; color: #2c3e50; font-size: 22px;">
                Generating ${travelCountry} Visa PDF
            </h3>
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border: 2px solid #2196f3;">
                <div style="color: #0d47a1; font-size: 14px; text-align: left;">
                    <strong style="display: block; margin-bottom: 8px;">📋 Applicant Details:</strong>
                    <div style="margin-left: 10px; line-height: 1.8;">
                        👤 ${fullName}<br>
                        🛂 ${passportNumber}<br>
                        📅 ${formattedDOB}
                    </div>
                </div>
            </div>
            <p style="color: #7f8c8d; margin: 10px 0; font-size: 14px;">
                Filling PDF form...
            </p>
            <div class="spinner" style="margin: 20px auto; width: 40px; height: 40px; 
                                        border: 4px solid #ecf0f1; border-top: 4px solid #e74c3c;
                                        border-radius: 50%; animation: spin 1s linear infinite;"></div>
        </div>
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5); z-index: 9999;"></div>
    `;

    if (!document.getElementById('pdf-gen-styles')) {
        const style = document.createElement('style');
        style.id = 'pdf-gen-styles';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(loadingDiv);

    const parseId = (value) => {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? null : parsed;
    };

    const currentRecordId = parseId(recordId);

    if (!currentRecordId) {
        alert('⚠️ Error: Unable to determine record ID.\n\nThis page must be opened with a valid ID parameter.');
        const loading = document.getElementById('pdf-generation-loading');
        if (loading) document.body.removeChild(loading);
        console.error('❌ Missing record ID. recordId:', recordId, 'recordType:', recordType, 'personal:', pData);
        return;
    }

    const normalizedRecordType = (recordType || '').trim() || 'traveler';
    const requestPayload = {
        travelerId: currentRecordId,
        travelCountry,
        recordType: normalizedRecordType,
        flatten: true
    };
    let PDF_FILL_ENDPOINT = "https://doc.visad.co.uk/api/visa/fill-form"
    fetch(PDF_FILL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/pdf'
        },
        body: JSON.stringify(requestPayload),
        credentials: 'include',
        cache: 'no-store'
    })
        .then(async (response) => {
            console.log('📡 Response received!');
            console.log('Status:', response.status, response.statusText);

            const loading = document.getElementById('pdf-generation-loading');
            if (loading) document.body.removeChild(loading);

            if (!response.ok) {
                let errorMessage = `Server error: ${response.status} - ${response.statusText}`;
                try {
                    const errorText = await response.text();
                    if (errorText) {
                        try {
                            const parsed = JSON.parse(errorText);
                            errorMessage = parsed.error || parsed.message || errorMessage;
                        } catch {
                            errorMessage = errorText;
                        }
                    }
                } catch (textErr) {
                    console.warn('Failed to parse error response body', textErr);
                }
                throw new Error(errorMessage);
            }

            const blob = await response.blob();
            return { blob, response };
        })
        .then(({ blob, response }) => {
            console.log('✅ PDF received! Size:', blob.size, 'bytes');

            const disposition = response.headers.get('content-disposition');
            const headerFilename = extractFilenameFromDisposition(disposition);
            const timestamp = new Date().toISOString().split('T')[0];
            const sanitizedName = fullName.replace(/[^a-zA-Z0-9]/g, '_') || `record_${currentRecordId}`;
            const sanitizedCountry = travelCountry.replace(/[^a-zA-Z0-9]/g, '_') || 'Austria';
            const fallbackFilename = `${sanitizedCountry}_Visa_${sanitizedName}_${timestamp}.pdf`;
            const filename = headerFilename || fallbackFilename;

            downloadPdfBlob(blob, filename, true);
            showPDFSuccessNotification(fullName, filename);
        })
        .catch((error) => {
            console.error('❌ PDF Generation Failed:', error);

            const loading = document.getElementById('pdf-generation-loading');
            if (loading) document.body.removeChild(loading);

            alert(`❌ PDF Generation Failed!\n\n${error.message}\n\nPlease check the console for more details.`);
            showPDFErrorNotification(error.message);
        });
}

// Success notification
function showPDFSuccessNotification(userName, filename) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
        color: white;
        padding: 20px 25px;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
        z-index: 10001;
        min-width: 350px;
        animation: slideInRight 0.4s ease-out;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 15px;">
            <i class="fas fa-check-circle" style="font-size: 28px; flex-shrink: 0;"></i>
            <div style="flex: 1;">
                <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                    PDF Generated Successfully!
                </h4>
                <p style="margin: 0; font-size: 13px; opacity: 0.95; line-height: 1.5;">
                    <strong>${userName}</strong><br>
                    ${filename}
                </p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; font-size: 20px; 
                           cursor: pointer; opacity: 0.8; padding: 0; width: 24px; height: 24px;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.animation = 'slideOutRight 0.4s ease-out';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 400);
        }
    }, 5000);
}

// Error notification
function showPDFErrorNotification(errorMessage) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
        color: white;
        padding: 20px 25px;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
        z-index: 10001;
        min-width: 350px;
        animation: slideInRight 0.4s ease-out;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 15px;">
            <i class="fas fa-exclamation-circle" style="font-size: 28px; flex-shrink: 0;"></i>
            <div style="flex: 1;">
                <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                    PDF Generation Failed
                </h4>
                <p style="margin: 0; font-size: 13px; opacity: 0.95; line-height: 1.5;">
                    ${errorMessage}
                </p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; font-size: 20px; 
                           cursor: pointer; opacity: 0.8; padding: 0; width: 24px; height: 24px;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after 8 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.animation = 'slideOutRight 0.4s ease-out';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 400);
        }
    }, 8000);
}

function extractFilenameFromDisposition(dispositionHeader) {
    if (!dispositionHeader) return null;

    const utfMatch = dispositionHeader.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
    if (utfMatch && utfMatch[1]) {
        const value = utfMatch[1].replace(/"/g, '').trim();
        try {
            return decodeURIComponent(value);
        } catch (_) {
            return value;
        }
    }

    const asciiMatch = dispositionHeader.match(/filename="?([^";]+)"?/i);
    if (asciiMatch && asciiMatch[1]) {
        return asciiMatch[1].trim();
    }

    return null;
}

function downloadPdfBlob(blob, filename, openInNewTab = true) {
    const url = window.URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    if (openInNewTab) {
        window.open(url, '_blank');
    }

    setTimeout(() => {
        window.URL.revokeObjectURL(url);
    }, 500);
}
// Function to show results with user data
function showHealthCheckResultWithUserData(success, details, userInfo) {
    // Create result modal
    const resultDiv = document.createElement('div');
    resultDiv.id = 'api-health-result';

    const icon = success
        ? '<i class="fas fa-check-circle" style="color: #27ae60;"></i>'
        : '<i class="fas fa-times-circle" style="color: #e74c3c;"></i>';

    const bgColor = success ? '#d4edda' : '#f8d7da';
    const borderColor = success ? '#27ae60' : '#e74c3c';
    const textColor = success ? '#155724' : '#721c24';

    // Build user info section
    let userInfoHTML = '';
    if (userInfo) {
        userInfoHTML = `
            <div style="background: #e3f2fd; padding: 20px; border-radius: 10px; 
                        border: 2px solid #2196f3; margin: 20px 0;">
                <h4 style="color: #0d47a1; margin: 0 0 15px 0; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-user"></i> Applicant Information (From Frontend)
                </h4>
                <div style="text-align: left; color: #1565c0; font-size: 15px; line-height: 2;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <span style="min-width: 150px;"><strong>👤 Full Name:</strong></span>
                        <span style="color: #0d47a1; font-weight: 600; font-size: 16px;">${userInfo.fullName}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <span style="min-width: 150px;"><strong>🛂 Passport Number:</strong></span>
                        <span style="color: #0d47a1; font-weight: 600; font-size: 16px;">${userInfo.passportNumber}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="min-width: 150px;"><strong>📅 Date of Birth:</strong></span>
                        <span style="color: #0d47a1; font-weight: 600; font-size: 16px;">${userInfo.dateOfBirth}</span>
                    </div>
                </div>
            </div>
        `;
    }

    let apiDetailsHTML = '';

    if (success) {
        apiDetailsHTML = `
            <div style="background: ${bgColor}; padding: 20px; border-radius: 10px; 
                        border: 2px solid ${borderColor}; margin: 20px 0;">
                <h4 style="color: ${textColor}; margin: 0 0 15px 0;">
                    ${icon} ${details.message || 'API Health Check Passed'}
                </h4>
                <div style="text-align: left; color: ${textColor}; font-size: 14px;">
                    <strong>Status Code:</strong> ${details.status}<br>
                    <strong>Status Text:</strong> ${details.statusText}<br>
                    <strong>Content-Type:</strong> ${details.headers['content-type'] || 'N/A'}<br>
                    ${details.proxyUsed ? '<strong>Via:</strong> PHP Proxy<br>' : ''}
                </div>
            </div>
        `;
    } else {
        apiDetailsHTML = `
            <div style="background: ${bgColor}; padding: 20px; border-radius: 10px; 
                        border: 2px solid ${borderColor}; margin: 20px 0;">
                <h4 style="color: ${textColor}; margin: 0 0 15px 0;">
                    ${icon} ${details.message || 'API Health Check Failed'}
                </h4>
                <div style="text-align: left; color: ${textColor}; font-size: 14px;">
                    ${details.status ? `<strong>Status:</strong> ${details.status} ${details.statusText}<br>` : ''}
                    ${details.type ? `<strong>Error Type:</strong> ${details.type}<br>` : ''}
                    ${details.message ? `<strong>Error:</strong> ${details.message}<br>` : ''}
                    ${details.proxyUsed ? '<strong>Via:</strong> PHP Proxy<br>' : ''}
                </div>
                ${details.solution ? `
                    <div style="margin-top: 20px; padding: 15px; background: #fff3cd; 
                                border-radius: 8px; border: 1px solid #ffc107;">
                        <div style="color: #856404; font-size: 13px; line-height: 1.6;">
                            ${details.solution}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    resultDiv.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: white; padding: 40px; border-radius: 15px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 10000; 
                    min-width: 550px; max-width: 700px; max-height: 80vh; overflow-y: auto;">
            <div style="text-align: center; margin-bottom: 10px;">
                <div style="font-size: 70px; margin-bottom: 15px;">
                    ${icon}
                </div>
                <h2 style="margin: 0; color: #2c3e50;">
                    Austria PDF Generation ${success ? 'Ready' : 'Failed'}
                </h2>
            </div>
            
            ${userInfoHTML}
            ${apiDetailsHTML}
            
            <div style="text-align: center; margin-top: 25px;">
                <button onclick="document.getElementById('api-health-result').remove(); document.getElementById('api-health-backdrop').remove();"
                        style="background: #3498db; color: white; border: none; padding: 12px 30px;
                               border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 600;
                               transition: background 0.3s;">
                    Close
                </button>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; 
                        border-radius: 8px; font-size: 12px; color: #6c757d;">
                <strong>📌 Note:</strong> Data fetched from frontend (recordData object)<br>
                <strong>Proxy:</strong> portugal_pdf_proxy.php<br>
                <strong>Target API:</strong> http://doc.visad.co.uk/health<br>
                <strong>Timestamp:</strong> ${new Date().toLocaleString()}
            </div>
        </div>
        <div id="api-health-backdrop" onclick="document.getElementById('api-health-result').remove(); this.remove();"
             style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.6); z-index: 9999; cursor: pointer;"></div>
    `;

    document.body.appendChild(resultDiv);

    // Add hover effect to close button
    const closeBtn = resultDiv.querySelector('button');
    closeBtn.addEventListener('mouseenter', function () {
        this.style.background = '#2980b9';
    });
    closeBtn.addEventListener('mouseleave', function () {
        this.style.background = '#3498db';
    });
}
// ========================================================================
// NOTIFICATION SYSTEM
// ========================================================================

function showPDFNotification(message, type = 'info', subtitle = '') {
    const notification = document.createElement('div');
    notification.className = `pdf-notification pdf-notification-${type}`;

    const icon = type === 'success'
        ? '<i class="fas fa-check-circle"></i>'
        : '<i class="fas fa-exclamation-circle"></i>';

    const subtitleHTML = subtitle
        ? `<div style="font-size: 12px; opacity: 0.9; margin-top: 5px;">${subtitle}</div>`
        : '';

    notification.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 15px;">
            <div style="font-size: 24px; flex-shrink: 0;">${icon}</div>
            <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 15px;">${message}</div>
                ${subtitleHTML}
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; font-size: 20px; 
                           cursor: pointer; opacity: 0.7; padding: 0; width: 24px; height: 24px;
                           transition: opacity 0.2s;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    const bgColor = type === 'success' ? '#27ae60' : '#e74c3c';
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        z-index: 10001;
        min-width: 320px;
        max-width: 400px;
        animation: slideInNotif 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.animation = 'slideOutNotif 0.4s ease-out';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 400);
        }
    }, 5000);
}

// ========================================================================
// BUTTON INITIALIZATION
// ========================================================================

function initAustriaPDFButton() {
    console.log('🔧 Initializing Austria PDF button...');

    const pdfButton = document.querySelector('[data-action="generate-austria-pdf"], [data-action="generate-portugal-pdf"]');

    if (pdfButton) {
        console.log('✓ Found Austria PDF button');

        pdfButton.replaceWith(pdfButton.cloneNode(true));
        const newButton = document.querySelector('[data-action="generate-austria-pdf"], [data-action="generate-portugal-pdf"]');

        newButton.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('🖱️ Austria PDF button clicked');

            const urlParams = new URLSearchParams(window.location.search);
            const recordId = urlParams.get('id');
            const recordType = urlParams.get('type') || 'traveler';

            console.log('📋 Current record:', { id: recordId, type: recordType });

            if (recordId) {
                generateAustriaPDF(recordId, recordType);
            } else {
                showPDFNotification('✗ No record ID found in URL', 'error',
                    'Please open this page with ?id=XXX parameter');
            }
        });

        console.log('✓ Austria PDF button initialized successfully');
    } else {
        console.warn('⚠ Austria PDF button not found in navigation');
        console.log('💡 Make sure you added the button to form_data_viewer.html');
    }
}

// ========================================================================
// FLOATING BUTTON ALTERNATIVE (OPTIONAL)
// ========================================================================

function addFloatingAustriaPDFButton() {
    // Check if button already exists
    if (document.getElementById('floating-portugal-pdf-btn')) {
        console.log('Floating PDF button already exists');
        return;
    }

    const floatingBtn = document.createElement('button');
    floatingBtn.id = 'floating-portugal-pdf-btn';
    floatingBtn.innerHTML = `
        <i class="fas fa-file-pdf" style="font-size: 20px;"></i>
        <span style="margin-left: 10px; font-weight: 600;">Generate Austria PDF</span>
    `;
    floatingBtn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: linear-gradient(135deg, #e74c3c, #c0392b);
        color: white;
        border: none;
        padding: 16px 28px;
        border-radius: 50px;
        font-size: 15px;
        box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        z-index: 999;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        font-family: inherit;
    `;

    // Hover effects
    floatingBtn.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-4px) scale(1.05)';
        this.style.boxShadow = '0 8px 25px rgba(231, 76, 60, 0.5)';
    });

    floatingBtn.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0) scale(1)';
        this.style.boxShadow = '0 6px 20px rgba(231, 76, 60, 0.4)';
    });

    // Click event
    floatingBtn.addEventListener('click', function () {
        const urlParams = new URLSearchParams(window.location.search);
        const recordId = urlParams.get('id');
        const recordType = urlParams.get('type') || 'traveler';

        if (recordId) {
            generateAustriaPDF(recordId, recordType);
        } else {
            showPDFNotification('✗ No record ID found', 'error');
        }
    });

    document.body.appendChild(floatingBtn);
    console.log('✓ Floating Austria PDF button added');
}

// ========================================================================
// AUTO-INITIALIZATION
// ========================================================================

// Wait for DOM to be fully loaded, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        console.log('📄 DOM loaded, initializing Austria PDF functionality...');

        setTimeout(() => {
            initAustriaPDFButton();
            // addFloatingAustriaPDFButton();
        }, 500);
    });
} else {
    console.log('📄 DOM already loaded, initializing Austria PDF functionality...');
    setTimeout(() => {
        initAustriaPDFButton();
        // addFloatingAustriaPDFButton();
    }, 500);
}

// ========================================================================
// EXPORT FOR MANUAL INITIALIZATION (IF NEEDED)
// ========================================================================

// If you need to call these functions manually, they're available globally:
window.generateAustriaPDF = generateAustriaPDF;
window.generatePortugalPDF = generateAustriaPDF;
window.initAustriaPDFButton = initAustriaPDFButton;
window.initPortugalPDFButton = initAustriaPDFButton;
window.addFloatingAustriaPDFButton = addFloatingAustriaPDFButton;
window.addFloatingPortugalPDFButton = addFloatingAustriaPDFButton;

console.log('✅ Austria PDF Generator loaded and ready!');

// ========================================================================
// MULTI-COUNTRY PDF GENERATION (Italy, Austria, Malta)
// ========================================================================

/**
 * Universal PDF Generator - Works for ALL countries
 * Backend auto-detects travel_country and routes accordingly
 * - Austria: Returns filled PDF
 * - Italy/Malta: Returns blank template
 */
function generateCountryPDF(recordId, recordType, countryName) {
    console.log(`🔄 Generating ${countryName} visa PDF...`);
    console.log('Record ID:', recordId, 'Type:', recordType);

    // Create loading overlay
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'pdf-generation-loading';
    loadingDiv.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: white; padding: 40px; border-radius: 15px; text-align: center;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 10000; min-width: 450px;">
            <i class="fas fa-file-pdf" style="font-size: 60px; color: #2563eb; margin-bottom: 20px;"></i>
            <h3 style="margin: 15px 0; color: #2c3e50; font-size: 22px;">
                Generating ${countryName} Visa PDF
            </h3>
            <p style="color: #7f8c8d; margin: 10px 0; font-size: 14px;">
                Processing form...
            </p>
            <div class="spinner" style="margin: 20px auto; width: 40px; height: 40px;
                                        border: 4px solid #ecf0f1; border-top: 4px solid #2563eb;
                                        border-radius: 50%; animation: spin 1s linear infinite;"></div>
        </div>
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5); z-index: 9999;"></div>
    `;

    document.body.appendChild(loadingDiv);

    // API endpoint - backend auto-detects country
    const apiUrl = 'https://doc.visad.co.uk/api/visa/fill-form-by-key';

    const requestPayload = {
        recordId: parseInt(recordId),
        recordType: recordType,
        includeDependents: false
    };

    console.log('📦 Request payload:', requestPayload);

    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/pdf'
        },
        body: JSON.stringify(requestPayload)
    })
        .then(response => {
            console.log('📡 Response received - Status:', response.status);

            // Remove loading
            const loading = document.getElementById('pdf-generation-loading');
            if (loading) document.body.removeChild(loading);

            if (!response.ok) {
                return response.json().then(errorData => {
                    const errorMsg = errorData.error || errorData.message || `Server error: ${response.status}`;
                    throw new Error(errorMsg);
                }).catch(jsonErr => {
                    if (jsonErr.message && !jsonErr.message.includes('Server error')) {
                        throw jsonErr;
                    }
                    throw new Error(`Server error: ${response.status} - ${response.statusText}`);
                });
            }

            return response.blob();
        })
        .then(blob => {
            console.log('✅ PDF received! Size:', blob.size, 'bytes');

            const url = window.URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `${countryName}_Visa_${timestamp}.pdf`;

            // Download the PDF
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // Also open in new tab
            window.open(url, '_blank');

            setTimeout(() => window.URL.revokeObjectURL(url), 100);

            // Show success notification
            showCountryPDFSuccess(countryName, filename);
        })
        .catch(error => {
            console.error('❌ PDF Generation Failed:', error);

            const loading = document.getElementById('pdf-generation-loading');
            if (loading) document.body.removeChild(loading);

            alert(`❌ PDF Generation Failed!\n\n${error.message}`);
            showCountryPDFError(error.message);
        });
}

// Success notification for country PDF
function showCountryPDFSuccess(countryName, filename) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
        color: white;
        padding: 20px 25px;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
        z-index: 10001;
        min-width: 350px;
        animation: slideInRight 0.4s ease-out;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 15px;">
            <i class="fas fa-check-circle" style="font-size: 28px; flex-shrink: 0;"></i>
            <div style="flex: 1;">
                <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                    ${countryName} PDF Generated!
                </h4>
                <p style="margin: 0; font-size: 13px; opacity: 0.95;">
                    ${filename}
                </p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()"
                    style="background: none; border: none; color: white; font-size: 20px;
                           cursor: pointer; opacity: 0.8;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.animation = 'slideOutRight 0.4s ease-out';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 400);
        }
    }, 5000);
}

// Error notification
function showCountryPDFError(errorMessage) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
        color: white;
        padding: 20px 25px;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
        z-index: 10001;
        min-width: 350px;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 15px;">
            <i class="fas fa-exclamation-circle" style="font-size: 28px;"></i>
            <div style="flex: 1;">
                <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                    PDF Generation Failed
                </h4>
                <p style="margin: 0; font-size: 13px; opacity: 0.95;">
                    ${errorMessage}
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 8000);
}

// Initialize universal PDF button (auto-detects country from database)
function initUniversalPDFButton() {
    console.log('🔧 Initializing universal PDF button...');

    const button = document.querySelector('[data-action="generate-pdf"]');

    if (button) {
        console.log('✓ Found Generate PDF button');

        button.replaceWith(button.cloneNode(true));
        const newButton = document.querySelector('[data-action="generate-pdf"]');

        newButton.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('🖱️ Generate PDF button clicked');

            const urlParams = new URLSearchParams(window.location.search);
            const recordId = urlParams.get('id');
            const recordType = urlParams.get('type') || 'traveler';

            if (recordId) {
                // Backend auto-detects country from database travel_country field
                generateUniversalPDF(recordId, recordType);
            } else {
                alert('Error: No record ID found');
            }
        });

        console.log('✓ Generate PDF button initialized');
    } else {
        console.warn('⚠ Generate PDF button not found');
    }
}

// Universal PDF Generator - Backend auto-detects country
function generateUniversalPDF(recordId, recordType) {
    console.log('🔄 Generating visa PDF (auto-detecting country from database)...');
    console.log('Record ID:', recordId, 'Type:', recordType);

    // Create loading overlay
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'pdf-generation-loading';
    loadingDiv.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: white; padding: 40px; border-radius: 15px; text-align: center;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 10000; min-width: 450px;">
            <i class="fas fa-file-pdf" style="font-size: 60px; color: #2563eb; margin-bottom: 20px;"></i>
            <h3 style="margin: 15px 0; color: #2c3e50; font-size: 22px;">
                Generating Visa PDF
            </h3>
            <p style="color: #7f8c8d; margin: 10px 0; font-size: 14px;">
                Auto-detecting country and processing form...
            </p>
            <div class="spinner" style="margin: 20px auto; width: 40px; height: 40px;
                                        border: 4px solid #ecf0f1; border-top: 4px solid #2563eb;
                                        border-radius: 50%; animation: spin 1s linear infinite;"></div>
        </div>
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5); z-index: 9999;"></div>
    `;

    document.body.appendChild(loadingDiv);

    // API endpoint - backend auto-detects country from travel_country field
    const apiUrl = 'https://doc.visad.co.uk/api/visa/fill-form-by-key';

    const requestPayload = {
        recordId: parseInt(recordId),
        recordType: recordType,
        includeDependents: false
    };

    console.log('📦 Request payload:', requestPayload);

    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/pdf'
        },
        body: JSON.stringify(requestPayload)
    })
        .then(response => {
            console.log('📡 Response received - Status:', response.status);

            // Remove loading
            const loading = document.getElementById('pdf-generation-loading');
            if (loading) document.body.removeChild(loading);

            if (!response.ok) {
                return response.json().then(errorData => {
                    const errorMsg = errorData.error || errorData.message || `Server error: ${response.status}`;
                    throw new Error(errorMsg);
                }).catch(jsonErr => {
                    if (jsonErr.message && !jsonErr.message.includes('Server error')) {
                        throw jsonErr;
                    }
                    throw new Error(`Server error: ${response.status} - ${response.statusText}`);
                });
            }

            return response.blob();
        })
        .then(blob => {
            console.log('✅ PDF received! Size:', blob.size, 'bytes');

            const url = window.URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().split('T')[0];

            // Get country name from recordData if available for filename
            const countryName = (window.recordData?.personal?.travel_country || 'Visa').replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `${countryName}_Application_${timestamp}.pdf`;

            // Download the PDF
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // Also open in new tab
            window.open(url, '_blank');

            setTimeout(() => window.URL.revokeObjectURL(url), 100);

            // Show success notification
            showUniversalPDFSuccess(filename);
        })
        .catch(error => {
            console.error('❌ PDF Generation Failed:', error);

            const loading = document.getElementById('pdf-generation-loading');
            if (loading) document.body.removeChild(loading);

            alert(`❌ PDF Generation Failed!\n\n${error.message}`);
            showCountryPDFError(error.message);
        });
}

// Success notification
function showUniversalPDFSuccess(filename) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
        color: white;
        padding: 20px 25px;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
        z-index: 10001;
        min-width: 350px;
        animation: slideInRight 0.4s ease-out;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 15px;">
            <i class="fas fa-check-circle" style="font-size: 28px; flex-shrink: 0;"></i>
            <div style="flex: 1;">
                <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                    PDF Generated Successfully!
                </h4>
                <p style="margin: 0; font-size: 13px; opacity: 0.95;">
                    ${filename}
                </p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()"
                    style="background: none; border: none; color: white; font-size: 20px;
                           cursor: pointer; opacity: 0.8;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.animation = 'slideOutRight 0.4s ease-out';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 400);
        }
    }, 5000);
}

// Initialize universal PDF button on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(() => {
            initUniversalPDFButton();
        }, 600);
    });
} else {
    setTimeout(() => {
        initUniversalPDFButton();
    }, 600);
}

// Export for manual use
window.generateUniversalPDF = generateUniversalPDF;
window.initUniversalPDFButton = initUniversalPDFButton;

console.log('✅ Multi-Country PDF Generator loaded!');

// ========================================================================
// END OF MULTI-COUNTRY PDF INTEGRATION
/**
 * Admin Edit Functionality Module
 * Add this code to form_data_viewer.js to enable editing
 * 
 * This module provides:
 * - Edit buttons on each section
 * - Input creation for all field types
 * - Save/cancel handlers
 * - Bulk edit capability (edit all fields in a section)
 * - Admin lock override
 */

// ============================================
// EDIT MODE STATE MANAGEMENT
// ============================================

let editModeState = {
    activeSection: null,
    originalValues: {},
    isEditing: false
};

// ============================================
// EDIT BUTTON HANDLERS
// ============================================

function setupEditHandlers() {
    // NEW: Double-click on display-value to edit single field
    $(document).on('dblclick', '.display-value', function (e) {
        e.preventDefault();
        const $item = $(this).closest('.info-item');
        const $section = $item.closest('.section');

        // Don't allow if section is already in edit mode
        if ($section.hasClass('editing')) {
            return;
        }

        // Don't allow editing file fields via double-click
        const fieldType = $item.data('field-type');
        if (fieldType === 'file') {
            return;
        }

        enterInlineEditMode($item);
    });
}

function enterEditMode(sectionId) {
    // Prevent multiple sections from being edited
    if (editModeState.isEditing && editModeState.activeSection !== sectionId) {
        alert('Please save or cancel the current section before editing another.');
        return;
    }

    const $section = $('#' + sectionId);
    editModeState.activeSection = sectionId;
    editModeState.isEditing = true;
    editModeState.originalValues = {};

    // Check if form is locked (access from global scope)
    const formLocked = (typeof isFormLocked !== 'undefined' && isFormLocked) ||
        (window.recordData && window.recordData.questions &&
            (window.recordData.questions.form_complete === '1' ||
                window.recordData.questions.form_complete === 1));

    if (formLocked) {
        showLockOverrideIndicator($section);
    }

    // Convert all info-items to edit mode
    $section.find('.info-item').each(function () {
        const $item = $(this);
        const fieldId = $item.data('field');
        const table = $item.data('table');
        const $displayValue = $item.find('.display-value');
        const currentValue = $displayValue.text().trim();

        // Store original value
        editModeState.originalValues[fieldId] = currentValue;

        // Get field definition
        const fieldDef = getFieldDefinition(fieldId);

        // Create edit input
        const $editInput = createEditInput(fieldId, fieldDef, currentValue);

        // Hide display value and show edit input
        $displayValue.hide();
        $item.append($editInput);
    });

    // Toggle buttons
    $section.find('.edit-btn').hide();
    $section.find('.cancel-btn, .save-btn').show();
    $section.addClass('editing');
}

function exitEditMode(sectionId, save = false) {
    const $section = $('#' + sectionId);

    if (!save) {
        // Revert all changes
        $section.find('.info-item').each(function () {
            const $item = $(this);
            $item.find('.edit-input-wrapper').remove();
            $item.find('.display-value').show();
        });
    }

    // Hide lock override indicator
    $section.find('.lock-override-indicator').remove();

    // Toggle buttons
    $section.find('.edit-btn').show();
    $section.find('.cancel-btn, .save-btn').hide();
    $section.removeClass('editing');

    editModeState.isEditing = false;
    editModeState.activeSection = null;
    editModeState.originalValues = {};
}

function showLockOverrideIndicator($section) {
    const indicator = $(`
        <div class="lock-override-indicator" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 8px 12px; border-radius: 6px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; font-size: 0.9rem;">
            <i class="fas fa-shield-alt"></i>
            <span><strong>Admin Override:</strong> Editing locked form</span>
        </div>
    `);
    $section.find('.section-header').after(indicator);
}

// ============================================
// CREATE EDIT INPUT
// ============================================

function createEditInput(fieldId, fieldDef, currentValue) {
    const $wrapper = $('<div class="edit-input-wrapper"></div>');
    let $input;

    // Remove "Not set" placeholder text
    if (currentValue === 'Not set' || currentValue === '') {
        currentValue = '';
    }

    switch (fieldDef.type) {
        case 'text':
        case 'email':
        case 'tel':
            $input = $(`<input type="${fieldDef.type || 'text'}" class="edit-input" data-field="${fieldId}" value="${escapeHtml(currentValue)}" placeholder="${fieldDef.placeholder || ''}">`);
            break;

        case 'date':
            // Convert display format (dd/mm/yyyy) to input format (yyyy-mm-dd)
            let dateValue = '';
            if (currentValue && currentValue !== 'Not set') {
                const parts = currentValue.split('/');
                if (parts.length === 3) {
                    dateValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            }
            $input = $(`<input type="date" class="edit-input" data-field="${fieldId}" value="${dateValue}">`);
            break;

        case 'select':
            $input = $(`<select class="edit-input" data-field="${fieldId}"></select>`);
            $input.append('<option value="">-- Select --</option>');
            if (fieldDef.options && Array.isArray(fieldDef.options)) {
                fieldDef.options.forEach(option => {
                    const selected = option === currentValue ? 'selected' : '';
                    $input.append(`<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`);
                });
            }
            break;

        case 'radio':
            $input = $('<div class="radio-group"></div>');
            if (fieldDef.options && Array.isArray(fieldDef.options)) {
                fieldDef.options.forEach(option => {
                    const checked = option === currentValue ? 'checked' : '';
                    const radioId = `${fieldId}_${option.replace(/\s+/g, '_')}`;
                    $input.append(`
                        <label class="radio-label">
                            <input type="radio" name="${fieldId}" value="${escapeHtml(option)}" ${checked} data-field="${fieldId}">
                            <span>${escapeHtml(option)}</span>
                        </label>
                    `);
                });
            }
            break;

        case 'textarea':
            $input = $(`<textarea class="edit-input" data-field="${fieldId}" rows="3" placeholder="${fieldDef.placeholder || ''}">${escapeHtml(currentValue)}</textarea>`);
            break;

        case 'file':
            // File inputs are handled separately via upload modal
            $input = $('<div class="file-edit-note" style="color: #64748b; font-style: italic;">Files are managed via the upload buttons</div>');
            break;

        default:
            $input = $(`<input type="text" class="edit-input" data-field="${fieldId}" value="${escapeHtml(currentValue)}">`);
    }

    $wrapper.append($input);
    return $wrapper;
}

function getFieldDefinition(fieldId) {
    // Access questions from global scope
    const questionsArray = window.questions || questions || [];

    // Check in questions array
    for (const q of questionsArray) {
        if (q.field === fieldId) {
            return q;
        }
        if (q.fields) {
            for (const f of q.fields) {
                if (f.id === fieldId) {
                    return f;
                }
            }
        }
    }

    // Check in editable personal fields
    const editableFields = window.editablePersonalFields || editablePersonalFields || [];
    if (editableFields.includes(fieldId)) {
        return {
            id: fieldId,
            type: fieldId === 'email' ? 'email' : fieldId.includes('phone') || fieldId.includes('contact') ? 'tel' : 'text',
            placeholder: fieldId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        };
    }

    // Check for country fields
    const countriesArray = window.countries || countries || [];
    if (fieldId.includes('country')) {
        return {
            id: fieldId,
            type: 'select',
            options: countriesArray
        };
    }

    // Default to text
    return {
        id: fieldId,
        type: 'text',
        placeholder: ''
    };
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// SAVE SECTION
// ============================================

function saveSection(sectionId) {
    const $section = $('#' + sectionId);
    const fieldsToUpdate = [];

    // Collect all changed values
    $section.find('.info-item').each(function () {
        const $item = $(this);
        const fieldId = $item.data('field');
        const table = $item.data('table') || 'questions';
        const $input = $item.find('.edit-input, input[type="radio"]:checked');

        let newValue = '';

        if ($input.length > 0) {
            if ($input.attr('type') === 'radio') {
                newValue = $input.val();
            } else if ($input.is('select')) {
                newValue = $input.val();
            } else if ($input.attr('type') === 'date') {
                // Convert yyyy-mm-dd to dd/mm/yyyy for display
                const dateVal = $input.val();
                if (dateVal) {
                    const parts = dateVal.split('-');
                    newValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
            } else {
                newValue = $input.val();
            }

            // Check if value changed
            const originalValue = editModeState.originalValues[fieldId];
            if (newValue !== originalValue) {
                fieldsToUpdate.push({
                    field: fieldId,
                    value: newValue,
                    table: table,
                    $item: $item
                });
            }
        }
    });

    if (fieldsToUpdate.length === 0) {
        // No changes, just exit edit mode
        exitEditMode(sectionId, true);
        return;
    }

    // Show saving indicator
    const $saveBtn = $section.find('.save-btn');
    const originalBtnText = $saveBtn.html();
    $saveBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Saving...');

    // Save all fields (bulk update)
    let savedCount = 0;
    let errorCount = 0;

    fieldsToUpdate.forEach((fieldData, index) => {
        updateFieldViaAdminAPI(fieldData.field, fieldData.value, fieldData.table)
            .then(response => {
                savedCount++;

                // Update display value
                fieldData.$item.find('.display-value').text(fieldData.value || 'Not set');
                fieldData.$item.find('.edit-input-wrapper').remove();
                fieldData.$item.find('.display-value').show();

                // Update recordData
                if (fieldData.table === 'personal') {
                    recordData.personal[fieldData.field] = fieldData.value;
                } else {
                    recordData.questions[fieldData.field] = fieldData.value;
                }

                // If all fields processed
                if (savedCount + errorCount === fieldsToUpdate.length) {
                    finishSave();
                }
            })
            .catch(error => {
                errorCount++;
                console.error('Failed to save field:', fieldData.field, error);

                // If all fields processed
                if (savedCount + errorCount === fieldsToUpdate.length) {
                    finishSave();
                }
            });
    });

    function finishSave() {
        $saveBtn.prop('disabled', false).html(originalBtnText);

        if (errorCount > 0) {
            alert(`Saved ${savedCount} field(s), but ${errorCount} failed. Please check the console for details.`);
        } else {
            // Show success message
            showSuccessMessage($section, `Successfully updated ${savedCount} field(s)`);
        }

        exitEditMode(sectionId, true);
    }
}

function updateFieldViaAdminAPI(field, value, table) {
    // --- FIX: Map mismatched frontend fields to backend fields ---
    // Legacy mapping removed - Backend now supports these fields directly

    // -------------------------------------------------------------

    // Access from global scope
    const recType = window.recordType || recordType;
    const recId = window.recordId || recordId;

    // Convert snake_case field name to camelCase for Spring Boot API
    const camelCaseField = snakeToCamelCase(field);

    // Build the endpoint for Spring Boot bulk update
    const endpoint = recType === 'traveler'
        ? `/api/travelers/${recId}/bulk`
        : `/api/dependents/${recId}/bulk`;

    console.log(`🔄 Updating field: ${field} (${camelCaseField}) = "${value}" via ${endpoint}`);

    return new Promise((resolve, reject) => {
        $.ajax({
            url: endpoint,
            type: 'PATCH',
            contentType: 'application/json',
            data: JSON.stringify({
                updates: {
                    [camelCaseField]: value
                }
            }),
            dataType: 'json',
            success: function (response) {
                console.log('✅ API Response:', response);
                if (response.status === 'success') {
                    resolve(response);
                } else {
                    console.error('❌ API Error:', response);
                    reject(response);
                }
            },
            error: function (xhr, status, error) {
                console.error('❌ AJAX Error:', {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    responseText: xhr.responseText,
                    error: error
                });
                reject({
                    message: xhr.responseJSON?.message || xhr.statusText || error,
                    xhr: xhr
                });
            }
        });
    });
}

function showSuccessMessage($section, message) {
    const $msg = $(`
        <div class="success-message" style="background: #10b981; color: white; padding: 10px 15px; border-radius: 6px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        </div>
    `);

    $section.find('.section-header').after($msg);

    setTimeout(() => {
        $msg.fadeOut(300, function () {
            $(this).remove();
        });
    }, 3000);
}

// ============================================
// INLINE EDIT MODE (Double-click single field)
// ============================================

function enterInlineEditMode($item) {
    const fieldId = $item.data('field');
    const table = $item.data('table') || 'questions';
    const $displayValue = $item.find('.display-value');
    const currentValue = $displayValue.text().trim();

    // Store original value
    $item.data('original-value', currentValue);

    // Get field definition
    const fieldDef = getFieldDefinition(fieldId);

    // Create edit input
    const $editInput = createEditInput(fieldId, fieldDef, currentValue);

    // Add inline edit controls
    const $controls = $(`
        <div class="inline-edit-controls" style="margin-top: 8px; display: flex; gap: 8px;">
            <button class="btn-primary inline-save-btn" style="padding: 4px 12px; font-size: 0.85rem;">
                <i class="fas fa-check"></i> Save
            </button>
            <button class="btn-secondary inline-cancel-btn" style="padding: 4px 12px; font-size: 0.85rem;">
                <i class="fas fa-times"></i> Cancel
            </button>
        </div>
    `);

    // Hide display value and show edit input
    $displayValue.hide();
    $item.append($editInput);
    $item.append($controls);
    $item.addClass('inline-editing');

    // Focus on input
    $editInput.find('input, select, textarea').first().focus();

    // Handle save
    $controls.find('.inline-save-btn').on('click', function () {
        saveInlineEdit($item, fieldId, table);
    });

    // Handle cancel
    $controls.find('.inline-cancel-btn').on('click', function () {
        exitInlineEditMode($item);
    });

    // Handle Enter key to save (for text inputs)
    $editInput.find('input[type="text"], input[type="email"], input[type="tel"]').on('keypress', function (e) {
        if (e.which === 13) {
            e.preventDefault();
            saveInlineEdit($item, fieldId, table);
        }
    });

    // Handle Escape key to cancel
    $editInput.find('input, select, textarea').on('keydown', function (e) {
        if (e.which === 27) {
            e.preventDefault();
            exitInlineEditMode($item);
        }
    });
}

function exitInlineEditMode($item) {
    $item.find('.edit-input-wrapper').remove();
    $item.find('.inline-edit-controls').remove();
    $item.find('.display-value').show();
    $item.removeClass('inline-editing');
}

function saveInlineEdit($item, fieldId, table) {
    const $input = $item.find('.edit-input, input[type="radio"]:checked');
    let newValue = '';
    let apiValue = null;

    if ($input.length > 0) {
        if ($input.attr('type') === 'radio') {
            newValue = $input.val();
        } else if ($input.is('select')) {
            newValue = $input.val();
        } else if ($input.attr('type') === 'date') {
            const dateVal = $input.val(); // Returns YYYY-MM-DD locally
            if (dateVal) {
                // For API: Send YYYY-MM-DD (ISO) to avoid timezone/parsing ambiguities
                apiValue = dateVal;

                // For Display: DD/MM/YYYY
                const parts = dateVal.split('-');
                newValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        } else {
            newValue = $input.val();
        }
    }

    // Default apiValue to newValue if not set specifically (e.g. for non-date fields)
    if (apiValue === null) apiValue = newValue;

    const originalValue = $item.data('original-value');

    // Check if value changed (compare against display value or original raw?)
    // Simpler to just compare new display value against original display value for now
    if (newValue === originalValue) {
        exitInlineEditMode($item);
        return;
    }

    // Show saving indicator
    const $saveBtn = $item.find('.inline-save-btn');
    const originalBtnText = $saveBtn.html();
    $saveBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');

    // Save via API (use apiValue)
    updateFieldViaAdminAPI(fieldId, apiValue, table)
        .then(response => {
            // Update display value (use newValue)
            $item.find('.display-value').text(newValue || 'Not set');

            // Update recordData
            if (table === 'personal') {
                window.recordData.personal[fieldId] = newValue;
            } else {
                window.recordData.questions[fieldId] = newValue;
            }

            // Show brief success indicator
            $item.css('background-color', '#d1fae5');
            setTimeout(() => {
                $item.css('background-color', '');
            }, 1000);

            exitInlineEditMode($item);
        })
        .catch(error => {
            console.error('Failed to save field:', fieldId, error);

            // Check if it's an "Invalid field" error
            const errorMsg = error.message || error.xhr?.responseJSON?.message || error.statusText || 'Failed to save. Please try again.';

            if (errorMsg.includes('Invalid field')) {
                // Show a more helpful message for unsupported fields
                alert(`⚠️ Field "${fieldId}" cannot be edited from this interface.\n\nThis field may be stored in a different table or requires backend support to be added.\n\nPlease contact the development team if this field should be editable.`);
            } else {
                alert(`Error saving ${fieldId}: ${errorMsg}`);
            }

            $saveBtn.prop('disabled', false).html(originalBtnText);
        });
}

// ============================================
// SETUP EDIT HANDLERS
// ============================================

function setupEditHandlers() {
    // Set up double-click handler for all editable info-items
    $(document).on('dblclick', '.info-item:not(.read-only):not(.inline-editing)', function (e) {
        // Don't edit if form is locked (unless admin override is enabled)
        if (window.isFormLocked) {
            console.log('⚠️ Form is locked - editing disabled');
            return;
        }

        const $item = $(this);
        const fieldId = $item.data('field');

        // Skip if no field ID
        if (!fieldId) return;

        // Skip if already in edit mode
        if ($item.hasClass('inline-editing')) return;

        // Skip special fields that have their own handlers
        // if (fieldId === 'has_stay_booking') return; // Enabled editing per user request

        // Skip file fields (handled by buttons)
        if ($item.find('.file-list').length > 0) return;

        console.log(`✏️ Double-clicked field: ${fieldId}`);

        // Enter inline edit mode
        enterInlineEditMode($item);
    });
}

function setupFileHandlers() {
    // 1. Upload Button -> Trigger Input
    $(document).on('click', '.upload-file-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const category = $(this).data('category');
        $(`#upload-${category}`).click();
    });

    // 2. File Input Change -> Upload
    $(document).on('change', '.hidden-file-input', function (e) {
        if (this.files && this.files.length > 0) {
            const file = this.files[0];
            const category = $(this).data('category');
            uploadFileToBackend(file, category);
        }
    });

    // 3. Delete Button -> Delete
    $(document).on('click', '.delete-file-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const filename = $(this).data('filename');
        // Encode filename as it may contain slashes if full path
        // Actually, backend might expect just the name or encoded path. 
        // We'll try sending encoded full path for now as that's what we have in 'f'

        if (confirm(`Are you sure you want to delete this file?`)) {
            deleteFileFromBackend(filename);
        }
    });
}

function uploadFileToBackend(file, category) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category); // Backend expects 'category'

    const endpoint = recordType === 'traveler'
        ? `/api/travelers/${recordId}/files`
        : `/api/dependents/${recordId}/files`;

    console.log(`📤 Uploading file to ${endpoint} with category ${category}`);

    // Show visual feedback (simple alert or toast for now, ideally strictly UI update)
    const $btn = $(`.upload-file-btn[data-category="${category}"]`);
    const originalText = $btn.html();
    $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Uploading...');

    $.ajax({
        url: endpoint,
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function (res) {
            console.log('✅ Upload success:', res);
            $btn.prop('disabled', false).html(originalText);

            // Reload the page or just the data to refresh the list
            // For simplicity, let's reload the data logic. 
            // Better: just reload the page for now to ensure clean state
            location.reload();
        },
        error: function (xhr, status, error) {
            console.error('❌ Upload failed:', xhr);
            alert('File upload failed: ' + (xhr.responseJSON?.message || error));
            $btn.prop('disabled', false).html(originalText);
        }
    });
}

function deleteFileFromBackend(filename) {
    // The filename might be "2024/01/doc.pdf"
    // We should encode it to be safe in URL: /api/.../files/2024%2F01%2Fdoc.pdf
    const encodedFilename = encodeURIComponent(filename);

    const endpoint = recordType === 'traveler'
        ? `/api/travelers/${recordId}/files/${encodedFilename}`
        : `/api/dependents/${recordId}/files/${encodedFilename}`;

    console.log(`🗑️ Deleting file: ${filename} via ${endpoint}`);

    $.ajax({
        url: endpoint,
        type: 'DELETE',
        success: function (res) {
            console.log('✅ Delete success:', res);
            location.reload(); // Refresh to update list
        },
        error: function (xhr, status, error) {
            console.error('❌ Delete failed:', xhr);
            alert('File deletion failed: ' + (xhr.responseJSON?.message || error));
        }
    });
}

// ============================================
// THEME & INITIALIZATION
// ============================================

function setupThemeToggle() {
    const $btn = $('#theme-toggle-btn');
    const $icon = $btn.find('i');
    const html = document.documentElement;

    // Load saved preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        $icon.removeClass('fa-moon').addClass('fa-sun');
    }

    // Toggle handler
    $btn.on('click', function () {
        const currentTheme = html.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            html.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            $icon.removeClass('fa-sun').addClass('fa-moon');
        } else {
            html.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            $icon.removeClass('fa-moon').addClass('fa-sun');
        }
    });
}

// Call this after renderSummaryView() completes
function initializeEditFunctionality() {
    setupEditHandlers();
    setupFileHandlers();
    setupThemeToggle();
    console.log('✅ Edit functionality initialized (double-click, files & theme)');
}

// Export for use in main file
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeEditFunctionality,
        enterEditMode,
        exitEditMode,
        saveSection
    };
}
