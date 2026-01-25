console.log("hjhjkj");
$(document).ready(function() {
    // Function to ensure Cover Letter nav item is active
    function ensureCoverLetterActive() {
        $('.nav-item').removeClass('active');
        $('.nav-item[data-action="covering-letter"]').addClass('active');
    }
    
    // Set active state immediately
    ensureCoverLetterActive();
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('id');
    const recordType = urlParams.get('type');
    
    let clientData = {
        personal: {},
        questions: {}
    };
    
    // Store co-travellers data globally
    let coTravellersData = [];
    
    // Schengen Embassy Addresses in the UK
    const embassyAddresses = {
        'Austria': 'Embassy of Austria\n18 Belgrave Mews West\nLondon SW1X 8HU\nUnited Kingdom',
        'Belgium': 'Embassy of Belgium\n17 Grosvenor Crescent\nLondon SW1X 7EE\nUnited Kingdom',
        'Croatia': 'Embassy of the Republic of Croatia\n21 Conway Street\nLondon W1T 6BN\nUnited Kingdom',
        'Czech Republic': 'Embassy of the Czech Republic\n26 Kensington Palace Gardens\nLondon W8 4QY\nUnited Kingdom',
        'Czechia': 'Embassy of the Czech Republic\n26 Kensington Palace Gardens\nLondon W8 4QY\nUnited Kingdom',
        'Denmark': 'Royal Danish Embassy\n55 Sloane Street\nLondon SW1X 9SR\nUnited Kingdom',
        'Estonia': 'Embassy of Estonia\n44 Queen\'s Gate Terrace\nLondon SW7 5PJ\nUnited Kingdom',
        'Finland': 'Embassy of Finland\n38 Chesham Place\nLondon SW1X 8HW\nUnited Kingdom',
        'France': 'Embassy of France\n21 Cromwell Road\nLondon SW7 2EN\nUnited Kingdom',
        'Germany': 'Embassy of the Federal Republic of Germany\n23 Belgrave Square\nLondon SW1X 8PZ\nUnited Kingdom',
        'Greece': 'Embassy of Greece\n1A Holland Park\nLondon W11 3TP\nUnited Kingdom',
        'Hungary': 'Embassy of Hungary\n35 Eaton Place\nLondon SW1X 8BY\nUnited Kingdom',
        'Iceland': 'Embassy of Iceland\n2A Hans Street\nLondon SW1X 0JE\nUnited Kingdom',
        'Italy': 'Embassy of Italy\n14 Three Kings Yard\nLondon W1K 4EH\nUnited Kingdom',
        'Latvia': 'Embassy of Latvia\n45 Nottingham Place\nLondon W1U 5LR\nUnited Kingdom',
        'Liechtenstein': 'Embassy of Liechtenstein\nChancery House, Chesham Street\nLondon SW1X 8NH\nUnited Kingdom',
        'Lithuania': 'Embassy of Lithuania\n2 Bessborough Gardens\nLondon SW1V 2JE\nUnited Kingdom',
        'Luxembourg': 'Embassy of Luxembourg\n27 Wilton Crescent\nLondon SW1X 8SD\nUnited Kingdom',
        'Malta': 'High Commission of Malta\nMalta House, 36-38 Piccadilly\nLondon W1J 0LE\nUnited Kingdom',
        'Netherlands': 'Embassy of the Kingdom of the Netherlands\n38 Hyde Park Gate\nLondon SW7 5DP\nUnited Kingdom',
        'Norway': 'Royal Norwegian Embassy\n25 Belgrave Square\nLondon SW1X 8QD\nUnited Kingdom',
        'Poland': 'Embassy of the Republic of Poland\n47 Portland Place\nLondon W1B 1JH\nUnited Kingdom',
        'Portugal': 'Embassy of Portugal\n11 Belgrave Square\nLondon SW1X 8PP\nUnited Kingdom',
        'Slovakia': 'Embassy of the Slovak Republic\n25 Kensington Palace Gardens\nLondon W8 4QY\nUnited Kingdom',
        'Slovenia': 'Embassy of the Republic of Slovenia\n10 Little College Street\nLondon SW1P 3SH\nUnited Kingdom',
        'Spain': 'Embassy of Spain\n39 Chesham Place\nLondon SW1X 8SB\nUnited Kingdom',
        'Sweden': 'Embassy of Sweden\n11 Montagu Place\nLondon W1H 2AL\nUnited Kingdom',
        'Switzerland': 'Embassy of Switzerland\n16-18 Montagu Place\nLondon W1H 2BQ\nUnited Kingdom'
    };
    
    // Check if required parameters are present
    if (!recordId || !recordType) {
        showError('Missing required parameters. Please access this page from the client form viewer.');
        return;
    }
    
    // Load client data
    loadClientData();
    
    function loadClientData() {
        // Check session first
        $.get('api/auth.php?action=check_session', function(sessionRes) {
            if (sessionRes.loggedin) {
                // Fetch client data based on type
                const endpoint = recordType === 'traveler' ? 'api/travelers.php' : 'api/dependents.php';
                
                $.get(`${endpoint}?action=get_form_data&id=${recordId}`, function(res) {
                    if (res.status === 'success' && res.data) {
                        processClientData(res.data);
                        generateCoveringLetter();
                        showLetterSection();
                    } else {
                        showError(res.message || 'Failed to load client data.');
                    }
                }, 'json').fail(function() {
                    showError('Server request failed. Please try again.');
                });
            } else {
                showError('Access Denied. Please log in to the VisaD Vault.');
            }
        }, 'json').fail(function() {
            showError('Authentication check failed.');
        });
    }
    
    function processClientData(flatData) {
        console.log('🔵 processClientData called with:', flatData);
        
        // Personal fields - MATCHING THE WORKING VERSION
        const personalFieldKeys = [
            'first_name', 'last_name', 'dob', 'nationality', 'passport_no', 'passport_issue', 'passport_expire',
            'contact_number', 'email', 'address_line_1', 'address_line_2', 'city', 'state_province', 'zip_code', 'country',
            'travel_country', 'visa_type', 'visa_center', 'package', 'place_of_birth', 'country_of_birth'
        ];
        
        // Separate personal and questions data
        personalFieldKeys.forEach(key => {
            if (flatData[key] !== undefined) {
                clientData.personal[key] = flatData[key];
            }
        });
        
        for (const [key, value] of Object.entries(flatData)) {
            if (personalFieldKeys.indexOf(key) === -1) {
                clientData.questions[key] = value;
            }
        }
        
        // Update header
        const fullName = ((clientData.personal.first_name || '') + ' ' + (clientData.personal.last_name || '')).trim();
        const visaCountry = clientData.personal.travel_country || 'Schengen';
        const visaType = clientData.personal.visa_type || 'Tourist';
        
        $('#client-name-badge').text(fullName.toUpperCase() || 'CLIENT NAME');
        $('#visa-country-header').text(visaCountry || 'Schengen');
        $('#visa-type-header').text(visaType || 'Tourist');
        
        // Check for uploaded client documents
        checkClientDocumentsStatus(flatData);
        
        console.log('🔵 About to call loadCoTravellers');
        // Load co-travellers
        loadCoTravellers();
        console.log('🔵 loadCoTravellers call completed');
    }
    
    function checkClientDocumentsStatus(data) {
        console.log('Checking client documents status...');
        
        let hasClientDocuments = false;
        let checklistComplete = false;
        
        // Check for any client-uploaded documents
        const clientDocFields = [
            'evisa_document_path',
            'share_code_document_path',
            'schengen_visa_image',
            'booking_documents_path'
        ];
        
        clientDocFields.forEach(field => {
            let files = data[field];
            
            if (files) {
                // If it's a string, try to parse as JSON
                if (typeof files === 'string') {
                    try {
                        files = JSON.parse(files);
                    } catch (e) {
                        // Not JSON, treat as single file
                        if (files.trim()) {
                            hasClientDocuments = true;
                        }
                    }
                }
                
                // If it's an array with items
                if (Array.isArray(files) && files.length > 0) {
                    hasClientDocuments = true;
                }
            }
        });
        
        // Check form completion status for checklist
        if (data.form_complete == 1 || data.form_complete === '1') {
            checklistComplete = true;
        }
        
        // Mark buttons if files exist
        if (hasClientDocuments) {
            $('.nav-item[data-action="client-documents"]').addClass('has-files');
            console.log('✅ Client documents found - button marked');
        }
        
        if (checklistComplete) {
            $('.nav-item[data-action="checklist"]').addClass('has-files');
            console.log('✅ Checklist complete - button marked');
        }
        
        // Also check if there are any uploaded documents in categories
        checkDocumentCategories();
    }
    
    function checkDocumentCategories() {
        // Check each document category for uploads
        const categories = ['insurance', 'flight', 'uk-evisa', 'application', 'appointment', 'hotel'];
        const categoryStatus = {
            insurance: false,
            flight: false,
            'uk-evisa': false,
            application: false,
            appointment: false,
            hotel: false
        };
        
        let completedCount = 0;
        let totalCategories = categories.length;
        
        // Function to check if all categories are complete
        function checkAllCategoriesComplete() {
            if (completedCount >= totalCategories) {
                $('.nav-item[data-action="checklist"]').addClass('has-files');
                console.log('✅ All document categories complete - Checklist marked');
            }
        }
        
        categories.forEach(category => {
            $.get(`api/document_upload.php?action=get_documents&record_id=${recordId}&record_type=${recordType}&category=${category}`, function(res) {
                if (res.status === 'success' && res.documents && res.documents.length > 0) {
                    // Mark this category as complete
                    categoryStatus[category] = true;
                    completedCount++;
                    
                    // Map category to action name
                    let actionName = category;
                    if (category === 'application') {
                        actionName = 'application-form';
                    }
                    // uk-evisa stays as uk-evisa
                    
                    $(`.nav-item[data-action="${actionName}"]`).addClass('has-files');
                    console.log(`✅ ${category} documents found`);
                    
                    // Check if all categories are now complete
                    checkAllCategoriesComplete();
                } else {
                    // Category has no documents
                    completedCount++;
                    console.log(`⚠️ No documents found for ${category}`);
                    
                    // Still check if all requests are done
                    checkAllCategoriesComplete();
                }
            }, 'json').fail(function() {
                console.log(`❌ Failed to check ${category}`);
                completedCount++;
                checkAllCategoriesComplete();
            });
        });
        
        // Also check client documents
        checkClientDocumentsForChecklist();
    }
    
    function checkClientDocumentsForChecklist() {
        // Wait a bit for all category checks to complete
        setTimeout(() => {
            const allButtons = [
                '.nav-item[data-action="insurance"]',
                '.nav-item[data-action="flight"]',
                '.nav-item[data-action="uk-evisa"]',
                '.nav-item[data-action="application-form"]',
                '.nav-item[data-action="appointment"]',
                '.nav-item[data-action="hotel"]',
                '.nav-item[data-action="client-documents"]'
            ];
            
            let allHaveFiles = true;
            
            allButtons.forEach(selector => {
                if (!$(selector).hasClass('has-files')) {
                    allHaveFiles = false;
                }
            });
            
            if (allHaveFiles) {
                $('.nav-item[data-action="checklist"]').addClass('has-files');
                console.log('✅✅✅ ALL DOCUMENTS UPLOADED - Checklist automatically marked!');
            } else {
                console.log('⚠️ Some documents still missing - Checklist not auto-marked');
                
                // Log which ones are missing
                allButtons.forEach(selector => {
                    if (!$(selector).hasClass('has-files')) {
                        const buttonText = $(selector).text().trim();
                        console.log(`   ❌ Missing: ${buttonText}`);
                    }
                });
            }
            
            // Final enforcement: Ensure covering-letter stays active
            ensureCoverLetterActive();
        }, 2000); // Wait 2 seconds for all AJAX calls to complete
    }
    
    function loadCoTravellers() {
        const p = clientData.personal || {};
        const q = clientData.questions || {};
        // Check both personal and questions for traveler_id
        const travelerId = p.traveler_id || q.traveler_id; // For dependents, this will have the main traveler ID
        const currentId = recordId;
        
        // Hide section initially
        $('#co-travellers-section').hide();
        
        console.log('=== loadCoTravellers CALLED ===');
        console.log('Loading co-travellers:', {
            recordType: recordType,
            currentId: currentId,
            travelerId: travelerId,
            personalData: p,
            questionsData: q,
            fullClientData: clientData
        });
        
        let mainTravelerId;
        
        if (recordType === 'traveler') {
            // Current record is main traveler
            mainTravelerId = currentId;
            console.log('✅ Current record is MAIN TRAVELER, using currentId:', mainTravelerId);
        } else if (recordType === 'dependent' && travelerId) {
            // Current record is co-traveller
            mainTravelerId = travelerId;
            console.log('✅ Current record is DEPENDENT, using traveler_id:', mainTravelerId);
        } else {
            console.log('❌ Cannot determine main traveler ID');
            console.log('   recordType:', recordType);
            console.log('   travelerId:', travelerId);
            console.log('   personalData keys:', Object.keys(p));
            console.log('   questionsData keys:', Object.keys(q));
            return;
        }
        
        // Fetch all travellers (main + dependents) and display them together
        const allTravellers = [];
        
        console.log('📡 Fetching main traveler with ID:', mainTravelerId);
        
        // First, fetch the main traveler
        $.get(`api/travelers.php?action=get_form_data&id=${mainTravelerId}`, function(mainRes) {
            console.log('📥 Main traveler response:', mainRes);
            console.log('Main traveler ID from API:', mainRes.data?.id, 'Expected:', mainTravelerId);
            
            if (mainRes.status === 'success' && mainRes.data) {
                // Mark as main traveller
                mainRes.data.is_main = true;
                mainRes.data.traveller_type = 'traveler';
                mainRes.data.id = mainTravelerId; // FORCE the ID to be correct
                console.log('✅ Main traveler added to list with ID:', mainRes.data.id, 'Name:', mainRes.data.first_name);
                allTravellers.push(mainRes.data);
            }
            
            console.log('📡 Fetching dependents for traveler ID:', mainTravelerId);
            
            // Then fetch all dependents
            $.get(`api/get_dependents.php?traveler_id=${mainTravelerId}`, function(depRes) {
                console.log('📥 Dependents response:', depRes);
                console.log('Number of dependents:', depRes.dependents?.length || 0);
                
                if (depRes.status === 'success' && depRes.dependents && depRes.dependents.length > 0) {
                    depRes.dependents.forEach((dep, index) => {
                        dep.is_main = false;
                        dep.traveller_type = 'dependent';
                        console.log(`  ✅ Dependent ${index + 1} - ID: ${dep.id}, Name: ${dep.first_name}`);
                        allTravellers.push(dep);
                    });
                }
                
                // Display all travellers together
                if (allTravellers.length > 0) {
                    console.log('=== FILTERING CO-TRAVELLERS ===');
                    console.log('All travellers fetched:', allTravellers.map(t => ({id: t.id, name: t.first_name, is_main: t.is_main})));
                    console.log('Current viewing - ID:', currentId, '(type:', typeof currentId, ') Type:', recordType);
                    
                    // Display all travellers except the current one being viewed
                    const travellersToDisplay = allTravellers.filter(t => {
                        const tId = parseInt(t.id);
                        const currentIdInt = parseInt(currentId);
                        
                        console.log(`  Checking: ${t.first_name || t.name} (ID: ${tId} / ${t.id}, is_main: ${t.is_main})`);
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
                    
                    console.log('Final travellers to display:', travellersToDisplay.map(t => ({id: t.id, name: t.first_name})));
                    console.log('=== END FILTERING ===');
                    
                    if (travellersToDisplay.length > 0) {
                        // Store globally for letter generation
                        window.coTravellersData = travellersToDisplay;
                        
                        // Get names for title with relationships
                        const names = travellersToDisplay.map(t => {
                            const firstName = t.first_name || t.name?.split(' ')[0] || '';
                            const relationship = t.relationship_to_main ? ` (${t.relationship_to_main})` : '';
                            return firstName.toUpperCase() + relationship;
                        }).filter(n => n).join(', ');
                        
                        if (names) {
                            $('#co-travellers-title').html(`CO-TRAVELLERS: ${names} <span style="font-size: 0.8rem; font-weight: 500; color: #059669; margin-left: 8px;">(Click to expand/edit)</span>`);
                        } else {
                            $('#co-travellers-title').text('CO-TRAVELLERS');
                        }
                        
                        console.log('🎉 DISPLAYING CO-TRAVELLERS ABOVE TOOLBAR');
                        displayCoTravellers(travellersToDisplay);
                        
                        // Add quick relationship selectors above the list
                        displayQuickRelationshipSelectors(travellersToDisplay);
                        
                        // Regenerate letter if it's already been generated
                        if ($('#letter-editor').html()) {
                            console.log('Regenerating letter with co-travellers info');
                            generateCoveringLetter();
                        }
                    } else {
                        console.log('⚠️ No other travellers to display after filtering');
                        $('#co-travellers-section').hide();
                    }
                } else {
                    console.log('⚠️ No travellers found at all');
                }
                
            }, 'json').fail(function(xhr, status, error) {
                console.error('❌ Failed to fetch dependents:', error, xhr.responseText);
            });
            
        }, 'json').fail(function(xhr, status, error) {
            console.error('❌ Failed to fetch main traveler:', error, xhr.responseText);
        });
    }
    
    function generateCoveringLetter() {
        const p = clientData.personal || {};
        const q = clientData.questions || {};
        
        // Extract data
        const fullName = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || '[Full Name]';
        const email = p.email || '[Email Address]';
        const phone = p.contact_number || '[Phone Number]';
        
        // Build UK address - format in 2 lines
        const addressLine1 = [p.address_line_1, p.address_line_2].filter(x => x && x.trim()).join(', ');
        const addressLine2 = [p.city, p.state_province, p.zip_code, p.country].filter(x => x && x.trim()).join(', ');
        const address = addressLine1 && addressLine2 ? `${addressLine1}\n${addressLine2}` : '[Full Address in the UK]';
        
        const nationality = p.nationality || 'Indian';
        const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        
        // Travel details
        const country = p.travel_country || 'Portugal';
        const startDate = q.travel_date_from ? formatDateForDisplay(q.travel_date_from) : '[Planned Travel Date]';
        const endDate = q.travel_date_to ? formatDateForDisplay(q.travel_date_to) : '[Planned Departure Date]';
        
        // Calculate days (inclusive of both start and end date)
        let days = '[X]';
        let dayWord = 'days';
        if (q.travel_date_from && q.travel_date_to) {
            try {
                // Parse dates - handle both YYYY-MM-DD and DD/MM/YYYY formats
                let start, end;
                
                if (q.travel_date_from.includes('-')) {
                    // Database format: YYYY-MM-DD
                    start = new Date(q.travel_date_from);
                } else if (q.travel_date_from.includes('/')) {
                    // Display format: DD/MM/YYYY
                    const parts = q.travel_date_from.split('/');
                    start = new Date(parts[2], parts[1] - 1, parts[0]);
                } else {
                    start = new Date(q.travel_date_from);
                }
                
                if (q.travel_date_to.includes('-')) {
                    // Database format: YYYY-MM-DD
                    end = new Date(q.travel_date_to);
                } else if (q.travel_date_to.includes('/')) {
                    // Display format: DD/MM/YYYY
                    const parts = q.travel_date_to.split('/');
                    end = new Date(parts[2], parts[1] - 1, parts[0]);
                } else {
                    end = new Date(q.travel_date_to);
                }
                
                // Validate dates
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    const diffTime = Math.abs(end - start);
                    days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
                    dayWord = days === 1 ? 'day' : 'days';
                }
            } catch (e) {
                console.error('Date calculation error:', e);
                days = '[X]';
            }
        }
        
        // Destination city
        const primaryDest = q.primary_destination || '[City Name]';
        const city = extractCityName(primaryDest);
        
        // Derive airport
        const airport = city !== '[City Name]' ? `${city}` : '[Airport/City Name]';
        
        // Get embassy address - simplified version without street address
        const embassyName = `Embassy of ${country}`;
        
        // Occupation details
        const occupation = q.occupation_status || 'Employee';
        const jobTitle = q.job_title || q.occupation_title || '[Job Title]';
        const companyName = q.company_name || q.employer_name || '[Your Company Name]';
        
        // Visitor status
        const fingerprintsTaken = q.fingerprints_taken || 'No';
        const previousVisitYear = q.previous_visit_year || '[Year]';
        const previousCity = q.previous_visit_city || '[Previous City]';
        
        // Optional returning visitor paragraph
        let returningVisitorNote = '';
        if (fingerprintsTaken === 'Yes' && previousVisitYear && previousCity && previousVisitYear !== '[Year]') {
            returningVisitorNote = `\n\nThis will be my second visit to ${country}. I previously visited ${previousCity} in ${previousVisitYear} and thoroughly enjoyed the experience. During that visit, I complied with all visa regulations and returned to the UK on schedule without any issues. I am excited to explore more of what ${country} has to offer.`;
        }
        
        // Residence status clarification
        let residenceStatus = '';
        if (nationality === 'Indian' || nationality === 'India') {
            residenceStatus = 'I am an Indian national currently residing in the United Kingdom and employed';
        } else if (nationality !== 'British' && nationality !== 'United Kingdom' && nationality !== 'UK') {
            residenceStatus = `I am a ${nationality} national currently residing in the United Kingdom and employed`;
        } else {
            residenceStatus = 'I am currently residing in the United Kingdom and employed';
        }
        
        // Return date for work
        let returnWorkDate = '[Date]';
        if (q.travel_date_to) {
            try {
                let returnDate;
                
                if (q.travel_date_to.includes('-')) {
                    // Database format: YYYY-MM-DD
                    returnDate = new Date(q.travel_date_to);
                } else if (q.travel_date_to.includes('/')) {
                    // Display format: DD/MM/YYYY
                    const parts = q.travel_date_to.split('/');
                    returnDate = new Date(parts[2], parts[1] - 1, parts[0]);
                } else {
                    returnDate = new Date(q.travel_date_to);
                }
                
                if (!isNaN(returnDate.getTime())) {
                    returnDate.setDate(returnDate.getDate() + 1);
                    returnWorkDate = returnDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                }
            } catch (e) {
                console.error('Return work date calculation error:', e);
                returnWorkDate = '[Date]';
            }
        }
        
        // Dynamic documents list
        const documentsAttached = generateDocumentsList(q);
        
        // Generate the letter with proper spacing and structure
        const letterHTML = `
<div style="line-height: 1.8;">
    <p style="margin-bottom: 0.5em;"><strong>${fullName.toUpperCase()}</strong><br>
    ${address.replace(/\n/g, '<br>')}<br>
    Email: ${email} | Phone: ${phone}</p>

    <p style="margin: 2em 0 1em 0;">${today}</p>

    <p style="margin-bottom: 1.5em;"><strong>The Consulate General<br>
    ${embassyName}</strong></p>

    <p style="margin-bottom: 1.5em;"><strong>Subject: Application for Schengen Tourist Visa</strong></p>

    <p style="margin-bottom: 1.5em;">Dear Sir/Madam,</p>

    <p style="margin-bottom: 1.5em; text-align: justify;">I, ${fullName.toUpperCase()}, am writing to apply for a Schengen Tourist Visa to visit ${country} from <strong>${startDate}</strong> to <strong>${endDate}</strong>, with ${airport} as my port of entry. ${residenceStatus} as ${jobTitle} at ${companyName}.${getCoTravellersIntroText()}</p>

    <p style="margin: 2em 0 0.5em 0;"><strong>Purpose of Visit:</strong></p>
    <p style="margin-bottom: 1.5em; text-align: justify;">The purpose of my visit is tourism and leisure. I have always admired ${country}'s ${getCulturalDescription(country)}. I wish to take time away from my work schedule to explore one of its most beautiful cities and experience its unique atmosphere firsthand.${returningVisitorNote}</p>

    <p style="margin: 2em 0 0.5em 0;"><strong>Travel Itinerary:</strong></p>
    <p style="margin-bottom: 1.5em; text-align: justify;">During my ${days}-${dayWord} stay, I plan to visit ${city} to explore major historic landmarks, museums, cultural sites, and experience the local atmosphere. ${getCityActivities(country, city)}</p>

    <p style="margin: 2em 0 0.5em 0;"><strong>Accommodation and Travel Details:</strong></p>
    <p style="margin-bottom: 1.5em; text-align: justify;">Travel Dates: ${startDate} – ${endDate} | Duration: ${days} ${dayWord} | Entry Point: ${airport} | Accommodation: Confirmed hotel booking in ${city} (details enclosed) | Flights: Return flights booked between London and ${city} (confirmation attached) | Insurance: Comprehensive travel insurance covering all Schengen countries.</p>

    <p style="margin: 2em 0 0.5em 0;"><strong>Financial Means:</strong></p>
    <p style="margin-bottom: 1.5em; text-align: justify;">This trip will be entirely self-funded through my employment income and personal savings. I have sufficient financial means to cover all expenses including travel, accommodation, meals, and daily activities. Supporting financial documents enclosed: Bank statements for the past three months, Pay slips for the past three months, and Employment confirmation with approved annual leave letter.</p>

    <p style="margin: 2em 0 0.5em 0;"><strong>Ties to the United Kingdom:</strong></p>
    <p style="margin-bottom: 1.5em; text-align: justify;">I have strong professional and personal ties to the United Kingdom, ensuring my return after this visit: Employment - Full-time ${jobTitle} at ${companyName} with ongoing responsibilities and projects | Residence - ${[p.address_line_1, p.address_line_2, p.city, p.state_province, p.zip_code].filter(x => x && x.trim()).join(', ')} | Return Plans - Confirmed return flight on ${endDate}; I am expected to resume work on ${returnWorkDate}. I fully understand the visa conditions and will strictly adhere to the permitted duration of stay.</p>

    <p style="margin: 2em 0 0.5em 0;"><strong>Supporting Documents:</strong></p>
    <p style="margin-bottom: 1.5em; text-align: justify;">${documentsAttached.replace(/\n/g, ' | ').replace(/^\d+\.\s*/gm, '').replace(/\s+\|\s+/g, ' | ')}</p>

    <p style="margin: 2em 0 0.5em 0;"><strong>Closing Statement:</strong></p>
    <p style="margin-bottom: 1.5em; text-align: justify;">Thank you for considering my application. I am very much looking forward to visiting ${country} and exploring ${city}'s ${getCulturalDescription(country)}. I assure you that I will comply with all visa requirements and return to the United Kingdom on the scheduled date. Should you require any additional information, please feel free to contact me at ${email} or ${phone}.</p>

    <p style="margin: 2em 0 1em 0;">Yours sincerely,</p>

    <p style="margin-top: 3em;"><strong>${fullName.toUpperCase()}</strong></p>
</div>`;
        
        $('#letter-editor').html(letterHTML);
    }
    
    function displayQuickRelationshipSelectors(travellers) {
        // Get current user's name
        const currentUserName = ((clientData.personal.first_name || '') + ' ' + (clientData.personal.last_name || '')).trim().toUpperCase();
        
        // Find the main traveller to get their name
        const mainTraveller = travellers.find(t => t.is_main === true);
        const mainTravellerName = mainTraveller 
            ? ((mainTraveller.first_name || '') + ' ' + (mainTraveller.last_name || '')).trim().toUpperCase()
            : 'MAIN TRAVELLER';
        
        // Create quick selector container before the list
        const $quickSelectors = $('<div id="quick-relationship-selectors" style="padding: 15px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; margin-bottom: 15px;"></div>');
        
        travellers.forEach(traveller => {
            const firstName = traveller.first_name || traveller.name?.split(' ')[0] || 'N/A';
            const lastName = traveller.last_name || traveller.name?.split(' ').slice(1).join(' ') || '';
            const fullName = `${firstName} ${lastName}`.trim().toUpperCase();
            const travellerId = traveller.id;
            const travellerType = traveller.traveller_type || 'traveler';
            const relationship = traveller.relationship_to_main || '';
            
            // Determine relationship label
            let relationshipLabel = '';
            if (recordType === 'traveler') {
                relationshipLabel = `to ${currentUserName}`;
            } else {
                if (traveller.is_main) {
                    relationshipLabel = `to ${currentUserName}`;
                } else {
                    relationshipLabel = `to ${mainTravellerName}`;
                }
            }
            
            // Build relationship dropdown
            const relationshipOptions = [
                { value: '', label: 'Select' },
                { value: 'Parent', label: 'Parent' },
                { value: 'Child', label: 'Child' },
                { value: 'Guardian', label: 'Guardian' },
                { value: 'Friend', label: 'Friend' },
                { value: 'Colleague', label: 'Colleague' },
                { value: 'Partner', label: 'Partner' },
                { value: 'Wife', label: 'Wife' },
                { value: 'Husband', label: 'Husband' },
                { value: 'Grandchild', label: 'Grandchild' },
                { value: 'Grandparent', label: 'Grandparent' },
                { value: 'Carer', label: 'Carer' },
                { value: 'Other', label: 'Other' }
            ];
            
            let relationshipOptionsHTML = relationshipOptions.map(opt => 
                `<option value="${opt.value}" ${relationship === opt.value ? 'selected' : ''}>${opt.label}</option>`
            ).join('');
            
            const $row = $(`
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 10px; background: white; border-radius: 6px; border: 1px solid #86efac;">
                    <i class="fas fa-user" style="color: #059669; font-size: 1rem;"></i>
                    <span style="font-weight: 600; color: #065f46; flex: 1;">${fullName}</span>
                    <span style="font-size: 0.85rem; color: #047857;">${relationshipLabel}:</span>
                    <select class="quick-relationship-select" data-id="${travellerId}" data-type="${travellerType}" style="padding: 6px 10px; border: 2px solid #86efac; border-radius: 6px; font-size: 0.9rem; background: white; color: #065f46; font-weight: 500; min-width: 130px;">
                        ${relationshipOptionsHTML}
                    </select>
                </div>
            `);
            
            $quickSelectors.append($row);
        });
        
        // Insert before the co-travellers list
        $('#co-travellers-list').before($quickSelectors);
        
        // Setup change handler for quick selectors
        $('.quick-relationship-select').on('change', function() {
            const $select = $(this);
            const travellerId = $select.data('id');
            const travellerType = $select.data('type');
            const relationship = $select.val();
            
            console.log('Quick relationship changed:', {travellerId, travellerType, relationship});
            
            // Save relationship
            saveRelationship(travellerId, travellerType, relationship);
            
            // Also update the corresponding dropdown in the expanded card
            $(`.relationship-select[data-id="${travellerId}"]`).val(relationship);
        });
    }
    
    function displayCoTravellers(travellers) {
        const $list = $('#co-travellers-list');
        $list.empty();
        
        // Clear quick selectors if they exist
        $('#quick-relationship-selectors').remove();
        
        // Safety check - don't show section if no travellers
        if (!travellers || travellers.length === 0) {
            console.log('displayCoTravellers called with no travellers - hiding section');
            $('#co-travellers-section').hide();
            return;
        }
        
        console.log('displayCoTravellers - Rendering', travellers.length, 'traveller(s)');
        
        // Get current user's name
        const currentUserName = ((clientData.personal.first_name || '') + ' ' + (clientData.personal.last_name || '')).trim().toUpperCase();
        
        // Find the main traveller to get their name
        const mainTraveller = travellers.find(t => t.is_main === true);
        const mainTravellerName = mainTraveller 
            ? ((mainTraveller.first_name || '') + ' ' + (mainTraveller.last_name || '')).trim().toUpperCase()
            : 'MAIN TRAVELLER';
        
        travellers.forEach(traveller => {
            const firstName = traveller.first_name || traveller.name?.split(' ')[0] || 'N/A';
            const lastName = traveller.last_name || traveller.name?.split(' ').slice(1).join(' ') || '';
            const fullName = `${firstName} ${lastName}`.trim();
            const gender = traveller.gender || 'N/A';
            const dob = traveller.dob || 'N/A';
            const nationality = traveller.nationality || 'N/A';
            const passportNo = traveller.passport_no || 'N/A';
            const contact = traveller.contact_number || traveller.whatsapp_contact || 'N/A';
            const travellerId = traveller.id;
            const travellerType = traveller.traveller_type || 'traveler';
            const isMain = traveller.is_main ? ' (MAIN TRAVELLER)' : '';
            const relationship = traveller.relationship_to_main || '';
            
            // Determine relationship label based on context
            let relationshipLabel = '';
            if (recordType === 'traveler') {
                // Viewing as main traveller - show relationship to main traveller
                relationshipLabel = `Relationship to ${currentUserName}`;
            } else {
                // Viewing as dependent
                if (traveller.is_main) {
                    // This card is for the main traveller
                    relationshipLabel = `Relationship to ${currentUserName}`;
                } else {
                    // This card is for another dependent - show relationship to main
                    relationshipLabel = `Relationship to ${mainTravellerName}`;
                }
            }
            
            // Build relationship dropdown
            const relationshipOptions = [
                { value: '', label: 'Select Relationship' },
                { value: 'Parent', label: 'Parent' },
                { value: 'Child', label: 'Child' },
                { value: 'Guardian', label: 'Guardian' },
                { value: 'Friend', label: 'Friend' },
                { value: 'Colleague', label: 'Colleague' },
                { value: 'Partner', label: 'Partner' },
                { value: 'Wife', label: 'Wife' },
                { value: 'Husband', label: 'Husband' },
                { value: 'Grandchild', label: 'Grandchild' },
                { value: 'Grandparent', label: 'Grandparent' },
                { value: 'Carer', label: 'Carer' },
                { value: 'Other', label: 'Other' }
            ];
            
            let relationshipOptionsHTML = relationshipOptions.map(opt => 
                `<option value="${opt.value}" ${relationship === opt.value ? 'selected' : ''}>${opt.label}</option>`
            ).join('');
            
            const $card = $(`
                <div class="co-traveller-card">
                    <div class="co-traveller-name">
                        <i class="fas fa-user"></i>
                        <span>${fullName.toUpperCase()}${isMain}</span>
                    </div>
                    <div class="co-traveller-details">
                        <div class="co-traveller-detail">
                            <span class="co-traveller-detail-label">${relationshipLabel}</span>
                            <select class="relationship-select" data-id="${travellerId}" data-type="${travellerType}" style="width: 100%; padding: 8px; border: 2px solid #86efac; border-radius: 6px; font-size: 0.9rem; background: white; color: #065f46; font-weight: 500;">
                                ${relationshipOptionsHTML}
                            </select>
                        </div>
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
                    <button class="co-traveller-button" onclick="window.location.href='covering_letter_schengen.html?id=${travellerId}&type=${travellerType}'">
                        <i class="fas fa-file-alt"></i>
                        View Covering Letter
                    </button>
                </div>
            `);
            
            $list.append($card);
        });
        
        // Setup relationship change handler
        $('.relationship-select').on('change', function() {
            const $select = $(this);
            const travellerId = $select.data('id');
            const travellerType = $select.data('type');
            const relationship = $select.val();
            
            console.log('Relationship changed:', {travellerId, travellerType, relationship});
            
            // Save relationship
            saveRelationship(travellerId, travellerType, relationship);
            
            // Also update the quick selector
            $(`.quick-relationship-select[data-id="${travellerId}"]`).val(relationship);
        });
        
        $('#co-travellers-section').fadeIn();
        
        // Setup toggle functionality for co-travellers section
        $('#co-travellers-toggle').off('click').on('click', function() {
            const $list = $('#co-travellers-list');
            const $chevron = $('#co-travellers-chevron');
            
            if ($list.is(':visible')) {
                $list.slideUp(300);
                $chevron.removeClass('rotated');
            } else {
                $list.slideDown(300);
                $chevron.addClass('rotated');
            }
        });
    }
    
    function saveRelationship(travellerId, travellerType, relationship) {
        // Get opposite relationship
        const oppositeRelationship = getOppositeRelationship(relationship);
        
        console.log('=== SAVING RELATIONSHIP ===');
        console.log('Traveller ID:', travellerId);
        console.log('Traveller Type:', travellerType);
        console.log('Relationship:', relationship);
        console.log('Opposite:', oppositeRelationship);
        console.log('Current User ID:', recordId);
        console.log('Current User Type:', recordType);
        
        // Determine which endpoint to use - ADD ?action=update_field to URL
        const endpoint = travellerType === 'traveler' 
            ? 'api/travelers.php?action=update_field' 
            : 'api/dependents.php?action=update_field';
        
        console.log('Endpoint for co-traveller:', endpoint);
        
        const postData = {
            id: travellerId,
            field: 'relationship_to_main',
            value: relationship
        };
        
        console.log('POST Data:', postData);
        
        // Save the relationship for the selected traveller
        $.post(endpoint, postData, function(res) {
            console.log('Response from server:', res);
            
            if (res.status === 'success') {
                console.log('✅ Relationship saved for traveller', travellerId);
                
                // Now save the opposite relationship for the current user
                const currentEndpoint = recordType === 'traveler' 
                    ? 'api/travelers.php?action=update_field' 
                    : 'api/dependents.php?action=update_field';
                
                console.log('Endpoint for current user:', currentEndpoint);
                
                const postData2 = {
                    id: recordId,
                    field: 'relationship_to_main',
                    value: oppositeRelationship
                };
                
                console.log('POST Data for current user:', postData2);
                
                $.post(currentEndpoint, postData2, function(res2) {
                    console.log('Response for current user:', res2);
                    
                    if (res2.status === 'success') {
                        console.log('✅ Opposite relationship saved for current user');
                        
                        // Update the stored co-travellers data with new relationship
                        if (window.coTravellersData) {
                            const travellerIndex = window.coTravellersData.findIndex(t => t.id == travellerId);
                            if (travellerIndex !== -1) {
                                window.coTravellersData[travellerIndex].relationship_to_main = relationship;
                            }
                        }
                        
                        // Regenerate letter to update co-travellers text
                        if ($('#letter-editor').html()) {
                            console.log('Regenerating letter with updated relationships');
                            generateCoveringLetter();
                        }
                        
                        // Show success notification
                        showNotification('Relationship saved successfully', 'success');
                    } else {
                        console.error('❌ Failed to save opposite relationship:', res2);
                        showNotification('Failed to save opposite relationship: ' + (res2.message || 'Unknown error'), 'error');
                    }
                }, 'json').fail(function(xhr, status, error) {
                    console.error('❌ Network error saving opposite relationship');
                    console.error('Status:', status);
                    console.error('Error:', error);
                    console.error('Response:', xhr.responseText);
                    showNotification('Network error: ' + error, 'error');
                });
                
            } else {
                console.error('❌ Failed to save relationship:', res);
                showNotification('Failed to save relationship: ' + (res.message || 'Unknown error'), 'error');
            }
        }, 'json').fail(function(xhr, status, error) {
            console.error('❌ Network error saving relationship');
            console.error('Status:', status);
            console.error('Error:', error);
            console.error('Response:', xhr.responseText);
            showNotification('Network error: ' + error, 'error');
        });
        
        console.log('=== END SAVING RELATIONSHIP ===');
    }
    
    function getOppositeRelationship(relationship) {
        const opposites = {
            'Parent': 'Child',
            'Child': 'Parent',
            'Guardian': 'Child',
            'Grandparent': 'Grandchild',
            'Grandchild': 'Grandparent',
            'Wife': 'Husband',
            'Husband': 'Wife',
            'Partner': 'Partner',
            'Friend': 'Friend',
            'Colleague': 'Colleague',
            'Carer': 'Child',
            'Other': 'Other'
        };
        
        return opposites[relationship] || relationship;
    }
    
    function showNotification(message, type) {
        const bgColor = type === 'success' ? '#10b981' : '#ef4444';
        const $notification = $(`
            <div style="position: fixed; top: 100px; right: 20px; background: ${bgColor}; color: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 9999; animation: slideInRight 0.3s ease;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}
            </div>
        `);
        
        $('body').append($notification);
        
        setTimeout(() => {
            $notification.fadeOut(300, function() {
                $(this).remove();
            });
        }, 3000);
    }
    
    function getCoTravellersIntroText() {
        // Check if we have stored co-travellers data from loadCoTravellers
        if (!window.coTravellersData || window.coTravellersData.length === 0) {
            return '';
        }
        
        const travellers = window.coTravellersData;
        
        if (travellers.length === 0) {
            return '';
        }
        
        let text = ' I am traveling with ';
        
        if (travellers.length === 1) {
            const t = travellers[0];
            const firstName = t.first_name || t.name?.split(' ')[0] || '';
            const lastName = t.last_name || t.name?.split(' ').slice(1).join(' ') || '';
            const fullName = `${firstName} ${lastName}`.trim().toUpperCase();
            const relationship = t.relationship_to_main ? `my ${t.relationship_to_main.toLowerCase()}` : 'my companion';
            const gender = t.gender ? t.gender.toLowerCase() : '';
            const pronoun = gender === 'male' ? 'his' : gender === 'female' ? 'her' : 'their';
            const passportNo = t.passport_no || 'N/A';
            const dob = t.dob || 'N/A';
            
            text += `${relationship}, <strong>${fullName}</strong>, ${pronoun} passport number: ${passportNo}, date of birth: ${dob}. `;
            
        } else {
            // Multiple co-travellers
            travellers.forEach((t, index) => {
                const firstName = t.first_name || t.name?.split(' ')[0] || '';
                const lastName = t.last_name || t.name?.split(' ').slice(1).join(' ') || '';
                const fullName = `${firstName} ${lastName}`.trim().toUpperCase();
                const relationship = t.relationship_to_main ? `my ${t.relationship_to_main.toLowerCase()}` : 'my companion';
                const gender = t.gender ? t.gender.toLowerCase() : '';
                const pronoun = gender === 'male' ? 'his' : gender === 'female' ? 'her' : 'their';
                const passportNo = t.passport_no || 'N/A';
                const dob = t.dob || 'N/A';
                
                if (index === 0) {
                    text += `${relationship}, <strong>${fullName}</strong>, ${pronoun} passport number: ${passportNo}, date of birth: ${dob}`;
                } else if (index === travellers.length - 1) {
                    text += `, and ${relationship}, <strong>${fullName}</strong>, ${pronoun} passport number: ${passportNo}, date of birth: ${dob}`;
                } else {
                    text += `, ${relationship}, <strong>${fullName}</strong>, ${pronoun} passport number: ${passportNo}, date of birth: ${dob}`;
                }
            });
            text += '. ';
        }
        
        text += 'We are all applying for our visas together and plan to travel as a group.';
        
        return ' ' + text;
    }
    
    function getCulturalDescription(country) {
        const descriptions = {
            'Portugal': 'fascinating culture, maritime heritage, and coastal beauty',
            'Italy': 'rich history, Renaissance art, and architectural masterpieces',
            'Spain': 'vibrant culture, stunning architecture, and Mediterranean charm',
            'France': 'art, culture, gastronomy, and historical landmarks',
            'Germany': 'engineering heritage, castles, and cultural diversity',
            'Greece': 'ancient history, mythology, and island beauty',
            'Netherlands': 'artistic heritage, canals, and cultural landmarks',
            'Austria': 'musical heritage, alpine beauty, and imperial history',
            'Belgium': 'medieval architecture, art, and culinary traditions',
            'Switzerland': 'alpine scenery, precision craftsmanship, and multilingual culture',
            'Poland': 'rich history, medieval towns, and cultural resilience',
            'Czech Republic': 'baroque architecture, beer culture, and historical charm',
            'Czechia': 'baroque architecture, beer culture, and historical charm',
            'Hungary': 'thermal baths, architectural grandeur, and Danube beauty',
            'Sweden': 'innovative design, Viking heritage, and natural beauty',
            'Denmark': 'modern design, Viking history, and coastal charm',
            'Norway': 'fjords, northern lights, and Viking heritage',
            'Finland': 'lakes, saunas, and unique Nordic culture',
            'Iceland': 'volcanic landscapes, northern lights, and unique natural phenomena',
            'Croatia': 'Adriatic coastline, medieval cities, and natural parks',
            'Slovenia': 'alpine scenery, caves, and green tourism',
            'Slovakia': 'mountain landscapes, castles, and folk traditions',
            'Estonia': 'medieval heritage, digital innovation, and Baltic charm',
            'Latvia': 'art nouveau architecture, forests, and Baltic culture',
            'Lithuania': 'baroque architecture, amber, and Baltic heritage',
            'Luxembourg': 'fortifications, financial hub, and multilingual culture',
            'Malta': 'ancient temples, fortified cities, and Mediterranean climate',
            'Liechtenstein': 'alpine scenery, castles, and cultural heritage'
        };
        return descriptions[country] || 'fascinating culture, rich heritage, and beautiful landscapes';
    }
    
    function getCityActivities(country, city) {
        const activities = {
            'Portugal': 'I also look forward to enjoying traditional Portuguese cuisine such as bacalhau and pastéis de nata and immersing myself in the local vibrant cultural and historical charm.',
            'Italy': 'I also look forward to experiencing authentic Italian cuisine, visiting art galleries, and exploring the rich Renaissance heritage.',
            'Spain': 'I also look forward to experiencing authentic Spanish tapas, flamenco culture, and the vibrant local lifestyle.',
            'France': 'I also look forward to experiencing French cuisine, visiting world-renowned museums, and exploring the artistic heritage.',
            'Germany': 'I also look forward to experiencing German beer culture, visiting historical sites, and exploring the engineering marvels.',
            'Greece': 'I also look forward to exploring ancient ruins, enjoying Mediterranean cuisine, and experiencing the island hospitality.',
            'Netherlands': 'I also look forward to visiting world-class museums, experiencing canal-side culture, and exploring the artistic heritage.',
            'Austria': 'I also look forward to experiencing classical music venues, alpine landscapes, and the imperial cultural heritage.',
            'Belgium': 'I also look forward to experiencing Belgian chocolate, beer culture, and the medieval architecture.',
            'Switzerland': 'I also look forward to experiencing Swiss chocolates, exploring alpine scenery, and visiting precision watch museums.',
            'Poland': 'I also look forward to exploring medieval towns, experiencing traditional Polish cuisine, and learning about the rich history.',
            'Czech Republic': 'I also look forward to experiencing Czech beer culture, visiting historical castles, and exploring baroque architecture.',
            'Czechia': 'I also look forward to experiencing Czech beer culture, visiting historical castles, and exploring baroque architecture.',
            'Hungary': 'I also look forward to experiencing thermal baths, enjoying Hungarian cuisine, and exploring the architectural beauty along the Danube.',
            'Sweden': 'I also look forward to experiencing Swedish design, visiting Viking heritage sites, and exploring the natural beauty.',
            'Denmark': 'I also look forward to experiencing Danish hygge culture, modern design, and the coastal charm.',
            'Norway': 'I also look forward to experiencing Norwegian culture, viewing the fjords, and exploring Viking heritage.',
            'Finland': 'I also look forward to experiencing sauna culture, exploring the thousands of lakes, and enjoying Nordic cuisine.',
            'Iceland': 'I also look forward to experiencing the unique volcanic landscapes, northern lights, and geothermal wonders.',
            'Croatia': 'I also look forward to exploring the Adriatic coastline, visiting medieval cities, and experiencing Mediterranean culture.',
            'Slovenia': 'I also look forward to exploring caves, alpine scenery, and experiencing sustainable green tourism.',
            'Slovakia': 'I also look forward to exploring mountain landscapes, visiting castles, and experiencing traditional folk culture.',
            'Estonia': 'I also look forward to exploring medieval old towns, experiencing digital innovation, and enjoying Baltic cuisine.',
            'Latvia': 'I also look forward to exploring art nouveau architecture, experiencing Baltic traditions, and visiting natural forests.',
            'Lithuania': 'I also look forward to exploring baroque architecture, experiencing amber culture, and learning about Baltic heritage.',
            'Luxembourg': 'I also look forward to exploring the fortifications, experiencing multilingual culture, and visiting the historical sites.',
            'Malta': 'I also look forward to exploring ancient temples, experiencing Mediterranean cuisine, and visiting fortified cities.',
            'Liechtenstein': 'I also look forward to exploring alpine scenery, visiting castles, and experiencing the unique mountain culture.'
        };
        return activities[country] || 'I also look forward to immersing myself in the local vibrant cultural and historical charm.';
    }
    
    function extractCityName(destination) {
        if (!destination || destination === '[City Name]') return '[City Name]';
        
        // Remove common airport codes and extract city name
        const cityMatch = destination.match(/^([^(]+)/);
        return cityMatch ? cityMatch[1].trim() : destination;
    }
    
    function generateDocumentsList(questions) {
        const docs = [
            '1. Completed Schengen visa application form',
            '2. Valid passport and photocopy',
            '3. UK E-visa and Immigration status share code',
            '4. Two recent passport-size photographs',
            '5. Bank statements (last 3 months)',
            '6. Pay slips (last 3 months)',
            '7. Employment letter and leave approval',
            '8. Travel insurance certificate',
            '9. Hotel booking confirmation',
            '10. Flight booking confirmation (return ticket) with fully paid invoice'
        ];
        
        // Add previous Schengen visa if fingerprints were taken
        if (questions.fingerprints_taken === 'Yes') {
            docs.push('11. Copy of Previous Schengen visa');
        }
        
        // Add credit card statement if they have a credit card
        if (questions.has_credit_card === 'Yes') {
            const docNumber = questions.fingerprints_taken === 'Yes' ? '12' : '11';
            docs.push(`${docNumber}. Copy of recent Credit card Statement`);
        }
        
        return docs.join('\n');
    }
    
    function formatDateForDisplay(dateStr) {
        if (!dateStr) return '[Date]';
        
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            if (dateStr === '0000-00-00') return '[Date]';
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        
        return dateStr;
    }
    
    function showLetterSection() {
        // Update header with client information
        const fullName = ((clientData.personal.first_name || '') + ' ' + (clientData.personal.last_name || '')).trim() || 'Loading...';
        const country = clientData.personal.travel_country || '-';
        const visaType = clientData.personal.visa_type || '-';
        const city = clientData.personal.visa_center || '-';
        const packageType = clientData.personal.package || '-';
        
        $('#client-name').text(fullName);
        $('#visa-country').text(country);
        $('#visa-type').text(visaType);
        $('#application-city').text(city);
        $('#package-type').text(packageType);
        
        // Ensure covering-letter nav item is active
        ensureCoverLetterActive();
        
        $('#loading-state').hide();
        $('#letter-section').show();
    }
    
    function showError(message) {
        $('#loading-state').hide();
        $('#error-message').text(message);
        $('#error-state').show();
    }
    
    // Reset button
    $('#reset-btn').on('click', function() {
        if (confirm('Are you sure you want to reset the letter? All changes will be lost.')) {
            generateCoveringLetter();
        }
    });
    
    // Close button
    $('#close-btn').on('click', function() {
        window.close();
        setTimeout(function() {
            window.history.back();
        }, 100);
    });
    
    // Download button - DOC format only
    $('#download-btn').on('click', function() {
        downloadAsDoc();
    });
    
    // Navigation Bar Click Handlers
    $('.nav-item').on('click', function() {
        const action = $(this).data('action');
        
        if (action === 'covering-letter') {
            // Already on covering letter page
            return;
        }
        
        if (action === 'client-documents') {
            // Navigate to form_data_viewer and scroll to client documents section
            window.location.href = `form_data_viewer.html?id=${recordId}&type=${recordType}#client-documents`;
            return;
        }
        
        if (action === 'checklist') {
            // Navigate to form_data_viewer checklist
            window.location.href = `form_data_viewer.html?id=${recordId}&type=${recordType}#checklist`;
            return;
        }
        
        const baseUrl = getActionUrl(action);
        
        if (baseUrl) {
            window.location.href = baseUrl;
        }
    });

    function getActionUrl(action) {
        const params = `?id=${recordId}&type=${recordType}`;
        
        switch(action) {
            case 'locker-data':
                return `form_data_viewer.html${params}`;
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

    // Check document status
    function checkDocumentStatus() {
        const categories = ['insurance', 'flight', 'application', 'appointment', 'hotel'];
        const categoryToAction = {
            'insurance': 'insurance',
            'flight': 'flight',
            'application': 'application-form',
            'appointment': 'appointment',
            'hotel': 'hotel'
        };
        
        categories.forEach(category => {
            $.get(`api/documents.php?action=get_documents&id=${recordId}&type=${recordType}&category=${category}`, function(res) {
                if (res.status === 'success' && res.documents && res.documents.length > 0) {
                    const action = categoryToAction[category];
                    $(`.nav-item[data-action="${action}"]`).addClass('has-files');
                }
            }, 'json');
        });
    }
    
    setTimeout(() => {
        checkDocumentStatus();
        // Ensure covering-letter is still active after all checks
        setTimeout(() => {
            ensureCoverLetterActive();
        }, 100);
    }, 500);

    function downloadAsDoc() {
        const fullName = ((clientData.personal.first_name || '') + ' ' + (clientData.personal.last_name || '')).trim() || 'Client';
        const country = clientData.personal.travel_country || 'Schengen';
        const filename = `${country}_Tourist_Visa_Letter_${fullName.replace(/\s+/g, '_')}.doc`;
        
        // Get the text content
        const content = $('#letter-editor').text();
        
        // Create RTF document
        let rtf = '{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\deflang1033\n';
        rtf += '{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}}\n';
        rtf += '{\\*\\generator Riched20 10.0.19041}\\viewkind4\\uc1\n';
        rtf += '\\pard\\sa200\\sl276\\slmult1\\f0\\fs22\n';
        
        // Split content into lines and process
        const lines = content.split('\n');
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
                // Escape special RTF characters
                let escaped = trimmed
                    .replace(/\\/g, '\\\\')
                    .replace(/{/g, '\\{')
                    .replace(/}/g, '\\}');
                
                // Make specific lines bold
                const isBold = trimmed.match(/^[A-Z][A-Z\s]+$|^Subject:|^Dear |^Yours sincerely,|^Purpose of Visit$|^Travel Itinerary$|^Accommodation and Travel Details$|^Financial Means$|^Ties to the United Kingdom$|^Supporting Documents$|^Closing Statement$/);
                
                if (isBold) {
                    rtf += '\\b ' + escaped + '\\b0\\par\n';
                } else if (trimmed.startsWith('•')) {
                    rtf += '\\tab ' + escaped + '\\par\n';
                } else {
                    rtf += escaped + '\\par\n';
                }
            } else {
                rtf += '\\par\n';
            }
        });
        
        rtf += '}';
        
        // Create blob and download
        const blob = new Blob([rtf], { type: 'application/rtf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => {
            URL.revokeObjectURL(link.href);
        }, 100);
        
        // Show success feedback
        const btn = $('#download-btn');
        const originalHtml = btn.html();
        btn.html('<i class="fas fa-check"></i> Downloaded!').prop('disabled', true);
        setTimeout(() => {
            btn.html(originalHtml).prop('disabled', false);
        }, 2000);
    }
    
    function escapeRtf(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/{/g, '\\{')
            .replace(/}/g, '\\}');
    }
});