<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// 1. Database Connection
// Handle inclusion whether db.php is in 'api' or '../api' depending on execution context
if (file_exists('api/db.php')) {
    require 'api/db.php';
} elseif (file_exists('db.php')) {
    require 'db.php';
} else {
    die("Error: db.php not found. Please check your file structure.");
}

// 2. Get Parameters
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$type = isset($_GET['type']) ? $_GET['type'] : 'traveler';

if ($id === 0) {
    die("Invalid Record ID");
}

// 3. Fetch Main Record
$table = ($type === 'dependent') ? 'dependents' : 'travelers';
$sql = "SELECT * FROM $table WHERE id = ?";
$stmt = $conn->prepare($sql);

if (!$stmt) {
    die("Database Error (Main Record): " . $conn->error);
}

$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();
$data = $result->fetch_assoc();
$stmt->close();

if (!$data) {
    die("Invoice not found.");
}

// 4. Handle Dependents (Co-Travelers) Logic
$dependents = [];
if ($type === 'traveler') {
    // STRICTLY fetch from 'dependents' table. 
    // We do NOT query 'travelers' table for dependents to avoid 'Unknown column traveler_id' error.
    $depSql = "SELECT * FROM dependents WHERE traveler_id = ?";
    $depStmt = $conn->prepare($depSql);
    if ($depStmt) {
        $depStmt->bind_param("i", $id);
        $depStmt->execute();
        $depResult = $depStmt->get_result();
        while ($row = $depResult->fetch_assoc()) {
            $dependents[] = $row;
        }
        $depStmt->close();
    }
} 

// 5. Fetch "Last Sent" History from 'invoice_history'
$last_sent_invoice = null;
$last_sent_t_invoice = null;

// Check if invoice_history table exists to prevent crashes if you haven't created it yet
$checkTable = $conn->query("SHOW TABLES LIKE 'invoice_history'");
if ($checkTable && $checkTable->num_rows > 0) {
    // Fetch Invoice History
    $histSql = "SELECT sent_at FROM invoice_history WHERE record_id = ? AND record_type = ? AND invoice_type = 'invoice' ORDER BY sent_at DESC LIMIT 1";
    $histStmt = $conn->prepare($histSql);
    if ($histStmt) {
        $histStmt->bind_param("is", $id, $type);
        $histStmt->execute();
        $histStmt->bind_result($sent_at_inv);
        if ($histStmt->fetch()) {
            $last_sent_invoice = date('d/m/Y h:i A', strtotime($sent_at_inv));
        }
        $histStmt->close();
    }

    // Fetch T-Invoice History
    $histSql = "SELECT sent_at FROM invoice_history WHERE record_id = ? AND record_type = ? AND invoice_type = 't-invoice' ORDER BY sent_at DESC LIMIT 1";
    $histStmt = $conn->prepare($histSql);
    if ($histStmt) {
        $histStmt->bind_param("is", $id, $type);
        $histStmt->execute();
        $histStmt->bind_result($sent_at_t);
        if ($histStmt->fetch()) {
            $last_sent_t_invoice = date('d/m/Y h:i A', strtotime($sent_at_t));
        }
        $histStmt->close();
    }
}

// 6. Helper Functions & Formatting
function getValue($val, $default = '') {
    return !empty($val) ? htmlspecialchars($val) : $default;
}

$customerName = trim(getValue($data['first_name']) . ' ' . getValue($data['last_name']));
if (empty($customerName)) $customerName = getValue($data['name'], 'Customer');

$invoiceNumber = 'INV-' . str_pad($data['id'], 4, '0', STR_PAD_LEFT);
// Remove any T- prefix if it exists in stored data
$invoiceNumber = preg_replace('/^T-/', '', $invoiceNumber);
$invoiceDate = date('d M Y'); 
$dueDate = date('d M Y', strtotime('+7 days'));

// Pricing Logic
$packageName = getValue($data['package'], 'Standard Package');
$visaType = getValue($data['visa_type'], 'Tourist Visa');
$country = getValue($data['travel_country']);

$basePrice = 149.00;
$packageLower = strtolower($packageName);

if (strpos($packageLower, 'appointment only') !== false) {
    $basePrice = 99.00;
} elseif (strpos($packageLower, 'full support') !== false && strpos($packageLower, 'fast track') === false) {
    $basePrice = 149.00;
} elseif (strpos($packageLower, 'fast track appointment') !== false) {
    $basePrice = 199.00;
} elseif (strpos($packageLower, 'fast track full support') !== false) {
    $basePrice = 349.00;
}

$items = [];
$items[] = [
    'name' => "$customerName - $packageName",
    'desc' => "$visaType" . ($country ? " - $country" : ""),
    'price' => $basePrice
];

foreach ($dependents as $dep) {
    $depPackage = !empty($dep['package']) ? $dep['package'] : $packageName;
    $depPackageLower = strtolower($depPackage);
    $depPrice = $basePrice;

    if (strpos($depPackageLower, 'appointment only') !== false) {
        $depPrice = 99.00;
    } elseif (strpos($depPackageLower, 'full support') !== false && strpos($depPackageLower, 'fast track') === false) {
        $depPrice = 149.00;
    } elseif (strpos($depPackageLower, 'fast track appointment') !== false) {
        $depPrice = 199.00;
    } elseif (strpos($depPackageLower, 'fast track full support') !== false) {
        $depPrice = 349.00;
    }

    $depName = trim($dep['first_name'] . ' ' . $dep['last_name']);
    if (empty($depName)) $depName = 'Co-Traveler';
    
    $depVisaType = !empty($dep['visa_type']) ? $dep['visa_type'] : $visaType;
    $depCountry = !empty($dep['travel_country']) ? $dep['travel_country'] : $country;

    $items[] = [
        'name' => "$depName - $depPackage",
        'desc' => "$depVisaType" . ($depCountry ? " - $depCountry" : "") . " (Co-Traveler)",
        'price' => $depPrice
    ];
}

$subtotal = 0;
foreach ($items as $item) {
    $subtotal += $item['price'];
}

// Discount
$discountType = isset($data['discount_type']) ? $data['discount_type'] : 'none';
$discountVal = isset($data['discount_value']) ? floatval($data['discount_value']) : 0;
$discountAmount = 0;
$discountLabel = '';

if ($discountType === 'percentage' && $discountVal > 0) {
    $discountAmount = ($subtotal * $discountVal) / 100;
    $discountLabel = "Discount ($discountVal%)";
} elseif ($discountType === 'fixed' && $discountVal > 0) {
    $discountAmount = $discountVal;
    $discountLabel = "Discount";
}

if ($discountAmount > $subtotal) $discountAmount = $subtotal;
$total = $subtotal - $discountAmount;

$paymentStatus = getValue($data['payment_status'], 'Unpaid');
$isPaid = (strtolower($paymentStatus) === 'paid');
$badgeClass = $isPaid ? 'status-badge-paid' : 'status-badge-unpaid';
$badgeText = $isPaid ? '✓ PAID' : 'UNPAID';

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice <?php echo $invoiceNumber; ?></title>
    <link rel="icon" type="image/png" href="favicon.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"/>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
    <style>
        :root {
            --primary: #003366;
            --primary-light: #004080;
            --accent: #0066cc;
            --accent-dark: #0052a3;
            --text-dark: #333333;
            --text-muted: #555555;
            --bg-light: #f8f9fa;
            --white: #ffffff;
        }
        * { box-sizing: border-box; }
        body { background-color: var(--bg-light); padding: 40px 20px; }
        .invoice-modal-container { background: none; padding: 0; min-height: auto; }
        .container { margin: 0 auto; max-width: 800px; background: var(--white); padding: 50px; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        
        /* Header Styles */
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 30px; border-bottom: 2px solid var(--bg-light); margin-bottom: 30px; flex-wrap: wrap; gap: 20px; }
        .company-info { text-align: left; flex: 1; }
        .company-name { color: var(--primary); font-size: 20px; font-weight: 700; margin-bottom: 8px; }
        .company-info p { margin: 4px 0; color: var(--text-muted); font-size: 14px; }
        .logo-section { text-align: right; flex: 1; }
        .logo-img { max-height: 50px; margin-bottom: 10px; display: block; margin-left: auto; }
        .invoice-title { color: var(--primary); font-size: 32px; font-weight: 700; margin: 0; text-align: right; }
        
        /* Invoice Number Section */
        .invoice-number-section { background: var(--primary); padding: 25px 30px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
        .invoice-number-label { color: rgba(255,255,255,0.8); font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        .invoice-number { color: var(--white); font-size: 28px; font-weight: 700; }
        
        /* Info Section */
        .info-section { display: flex; justify-content: space-between; gap: 30px; margin-bottom: 40px; flex-wrap: wrap; }
        .bill-to { flex: 1; min-width: 250px; }
        .bill-to h3 { color: var(--primary); font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0; }
        .customer-name { color: var(--text-dark); font-size: 18px; font-weight: 600; margin-bottom: 8px; }
        .bill-to p { margin: 4px 0; color: var(--text-muted); font-size: 14px; }
        
        .invoice-details { background: var(--bg-light); padding: 20px 25px; border-radius: 12px; min-width: 280px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: var(--text-muted); font-size: 14px; }
        .detail-value { color: var(--text-dark); font-weight: 600; font-size: 14px; }
        .total-highlight { color: var(--primary); font-size: 18px; font-weight: 700; }
        
        /* Status Badges */
        .payment-status-badge { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-badge-paid { background: #d1fae5; color: #065f46; }
        .status-badge-unpaid { background: #fee2e2; color: #991b1b; }
        
        /* Table Styles */
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .items-table thead { background: var(--primary); }
        .items-table th { color: var(--white); padding: 16px 20px; text-align: left; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .items-table th:first-child { border-radius: 6px 0 0 6px; }
        .items-table th:last-child { border-radius: 0 6px 6px 0; }
        .items-table td { padding: 20px; border-bottom: 1px solid var(--bg-light); color: var(--text-dark); }
        .items-table tbody tr:hover { background: var(--bg-light); }
        .item-name { font-weight: 600; color: var(--text-dark); margin-bottom: 4px; }
        .item-description { font-size: 13px; color: var(--text-muted); }
        
        /* Totals */
        .totals { margin-left: auto; max-width: 320px; background: var(--bg-light); padding: 20px 25px; border-radius: 12px; }
        .total-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 15px; }
        .total-row.subtotal { color: var(--text-muted); }
        .total-row.discount { color: #059669; }
        .total-row.final { border-top: 2px solid var(--primary); padding-top: 15px; margin-top: 10px; font-size: 20px; font-weight: 700; color: var(--primary); }
        
        /* Footer */
        .footer { margin-top: 50px; padding-top: 30px; border-top: 2px solid var(--bg-light); text-align: center; }
        .footer p { margin: 8px 0; color: var(--text-muted); font-size: 14px; }
        .payment-received { color: #059669; font-weight: 600; }
        
        /* Action Bar */
        .action-bar { max-width: 800px; margin: 0 auto 20px auto; display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; position: relative; z-index: 100; }
        .action-btn { padding: 12px 24px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; color: #ffffff; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; font-family: 'Inter', sans-serif; font-size: 14px; transition: all 0.2s ease; -webkit-appearance: none; appearance: none; background: var(--accent); touch-action: manipulation; }
        .print-btn { background: var(--accent); color: #ffffff; box-shadow: 0 2px 8px rgba(0,102,204,0.3); }
        .print-btn:hover, .print-btn:active { background: var(--accent-dark); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,102,204,0.4); }
        
        /* Print Styles */
        @media print {
            @page { 
                size: A4; 
                margin: 8mm; 
            }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body { 
                width: 210mm; 
                margin: 0; 
                padding: 0; 
                font-size: 10px;
                background: white !important; 
            }
            .no-print { display: none !important; }
            .invoice-modal-container { padding: 0; margin: 0; }
            .container { 
                box-shadow: none !important; 
                margin: 0; 
                padding: 8px 12px; 
                width: 100%; 
                max-width: 100%; 
                border-radius: 0;
            }
            .header { 
                display: flex !important;
                flex-direction: row !important;
                justify-content: space-between !important;
                padding-bottom: 8px; 
                margin-bottom: 8px; 
                gap: 10px;
                border-bottom: 1px solid #e0e0e0;
                flex-wrap: nowrap !important;
            }
            .company-info { 
                text-align: left !important; 
                flex: 1;
                order: 1 !important;
            }
            .logo-section { 
                text-align: right !important; 
                flex: 1;
                order: 2 !important;
            }
            .logo-img { 
                max-height: 30px; 
                margin-bottom: 5px; 
                margin-left: auto !important; 
                display: block !important;
            }
            .invoice-title { 
                font-size: 20px; 
                text-align: right !important; 
            }
            .company-name { font-size: 12px; margin-bottom: 4px; text-align: left !important; }
            .company-info p { font-size: 9px; margin: 1px 0; text-align: left !important; }
            .invoice-number-section { 
                padding: 8px 12px; 
                margin-bottom: 8px; 
                border-radius: 4px;
            }
            .invoice-number-label { font-size: 8px; margin-bottom: 2px; }
            .invoice-number { font-size: 16px; }
            .info-section { 
                gap: 10px; 
                margin-bottom: 10px; 
            }
            .bill-to { min-width: 180px; }
            .bill-to h3 { font-size: 9px; margin-bottom: 4px; }
            .customer-name { font-size: 11px; margin-bottom: 3px; }
            .bill-to p { font-size: 9px; margin: 1px 0; }
            .invoice-details { 
                padding: 8px 10px; 
                border-radius: 4px;
                min-width: 160px;
            }
            .detail-row { padding: 3px 0; }
            .detail-label, .detail-value { font-size: 9px; }
            .total-highlight { font-size: 11px; }
            .payment-status-badge { padding: 2px 6px; font-size: 8px; }
            .items-table { margin-bottom: 8px; }
            .items-table th { 
                padding: 6px 8px; 
                font-size: 8px; 
            }
            .items-table td { 
                padding: 6px 8px; 
                font-size: 9px;
            }
            .item-name { font-size: 10px; margin-bottom: 1px; }
            .item-description { font-size: 8px; }
            .totals { 
                padding: 8px 10px; 
                border-radius: 4px;
                max-width: 200px;
            }
            .total-row { padding: 3px 0; font-size: 10px; }
            .total-row.final { 
                font-size: 12px; 
                padding-top: 6px; 
                margin-top: 4px; 
            }
            .footer { 
                margin-top: 10px; 
                padding-top: 8px; 
                border-top: 1px solid #e0e0e0;
            }
            .footer p { font-size: 9px; margin: 2px 0; }
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
            body { padding: 15px; }
            .container { padding: 25px; border-radius: 12px; }
            .header { flex-direction: column-reverse; text-align: center; }
            .company-info { text-align: center; width: 100%; }
            .logo-section { text-align: center; width: 100%; margin-bottom: 15px; }
            .logo-img { margin: 0 auto 10px auto; }
            .invoice-title { font-size: 26px; text-align: center; }
            .invoice-number-section { padding: 20px; }
            .invoice-number { font-size: 22px; }
            .info-section { flex-direction: column; }
            .invoice-details { width: 100%; }
            .items-table { font-size: 14px; }
            .items-table th, .items-table td { padding: 12px 10px; }
            .totals { max-width: 100%; }
            .action-bar { justify-content: center; }
        }
        
        /* iPhone 6/7/8 and similar (375px) */
        @media (max-width: 414px) {
            body { padding: 8px; overflow-x: hidden; }
            .container { padding: 15px; border-radius: 10px; width: 100%; max-width: 100%; overflow: hidden; }
            .header { gap: 10px; flex-direction: column-reverse; }
            .logo-section { text-align: center; width: 100%; }
            .logo-img { max-height: 40px; margin: 0 auto 8px auto; }
            .invoice-title { font-size: 22px; text-align: center; }
            .company-info { text-align: center; width: 100%; }
            .company-name { font-size: 16px; }
            .company-info p { font-size: 12px; }
            .invoice-number-section { padding: 15px 10px; border-radius: 8px; margin-bottom: 20px; margin-left: 0; margin-right: 0; width: 100%; box-sizing: border-box; }
            .invoice-number-label { font-size: 11px; }
            .invoice-number { font-size: 18px; word-break: break-all; }
            .info-section { gap: 20px; margin-bottom: 25px; }
            .bill-to { min-width: 100%; }
            .bill-to h3 { font-size: 12px; margin-bottom: 8px; }
            .customer-name { font-size: 15px; }
            .bill-to p { font-size: 13px; }
            .invoice-details { padding: 15px; border-radius: 8px; min-width: 100%; box-sizing: border-box; }
            .detail-row { padding: 6px 0; }
            .detail-label { font-size: 12px; }
            .detail-value { font-size: 12px; }
            .total-highlight { font-size: 15px; }
            .payment-status-badge { padding: 4px 10px; font-size: 10px; }
            .items-table { font-size: 12px; margin-bottom: 20px; width: 100%; table-layout: fixed; }
            .items-table th { padding: 10px 8px; font-size: 11px; }
            .items-table td { padding: 12px 8px; word-wrap: break-word; }
            .items-table th:nth-child(2), .items-table td:nth-child(2) { display: none; }
            .items-table th:nth-child(3), .items-table td:nth-child(3) { display: none; }
            .items-table th:first-child, .items-table td:first-child { width: 70%; }
            .items-table th:last-child, .items-table td:last-child { width: 30%; text-align: right; }
            .item-name { font-size: 13px; word-wrap: break-word; }
            .item-description { font-size: 11px; }
            .totals { padding: 15px; border-radius: 8px; width: 100%; box-sizing: border-box; }
            .total-row { font-size: 13px; padding: 8px 0; }
            .total-row.final { font-size: 16px; padding-top: 12px; margin-top: 8px; }
            .footer { margin-top: 30px; padding-top: 20px; }
            .footer p { font-size: 12px; margin: 6px 0; }
            .action-btn { padding: 10px 20px; font-size: 13px; width: 100%; justify-content: center; min-height: 48px; }
        }
        
        /* iPhone SE and smaller (320px) */
        @media (max-width: 350px) {
            body { padding: 5px; }
            .container { padding: 10px; }
            .logo-img { max-height: 35px; }
            .invoice-title { font-size: 20px; }
            .company-name { font-size: 14px; }
            .invoice-number-section { padding: 12px 8px; }
            .invoice-number { font-size: 16px; }
            .customer-name { font-size: 14px; }
            .items-table th { padding: 8px 6px; font-size: 10px; }
            .items-table td { padding: 10px 6px; }
            .item-name { font-size: 12px; }
            .total-row.final { font-size: 15px; }
        }
    </style>
    <script>
        function printInvoice() {
            try {
                // Small delay for iOS compatibility
                setTimeout(function() {
                    if (window.print) {
                        window.print();
                    } else {
                        alert('Print is not supported on this device. Please use your browser menu to print or save as PDF.');
                    }
                }, 100);
            } catch(e) {
                alert('Unable to print. Please use your browser menu to print or save as PDF.');
            }
            return false;
        }
        
        // Ensure touch events work on mobile
        document.addEventListener('DOMContentLoaded', function() {
            var printBtn = document.getElementById('printBtn');
            if (printBtn) {
                printBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    printInvoice();
                });
                printBtn.addEventListener('touchstart', function(e) {
                    this.style.backgroundColor = '#0052a3';
                });
                printBtn.addEventListener('touchend', function(e) {
                    this.style.backgroundColor = '#0066cc';
                    e.preventDefault();
                    printInvoice();
                });
            }
        });
    </script>
</head>
<body>

    <div class="action-bar no-print">
        <button type="button" id="printBtn" class="action-btn print-btn">
            <i class="fas fa-print"></i> Print / Save as PDF
        </button>
    </div>

    <div class="invoice-modal-container">
        <div class="container" id="invoice-content">
            <div class="header">
                <div class="company-info">
                    <div class="company-name">VISAD.CO.UK</div>
                    <p>7 Bell Yard</p>
                    <p>London WC2A 2JR</p>
                    <p>support@visad.co.uk</p>
                </div>
                <div class="logo-section">
                    <img src="https://www.visad.co.uk/wp-content/uploads/2025/05/new-logo.png" alt="VISAD.CO.UK Logo" class="logo-img">
                    <h1 class="invoice-title">Invoice</h1>
                </div>
            </div>

            <div class="invoice-number-section">
                <div class="invoice-number-box">
                    <div class="invoice-number-label">Invoice Number</div>
                    <div class="invoice-number"><?php echo $invoiceNumber; ?></div>
                </div>
            </div>

            <div class="info-section">
                <div class="bill-to">
                    <h3>Bill To:</h3>
                    <div class="customer-name"><?php echo $customerName; ?></div>
                    <?php if(!empty($data['address_line_1'])) echo '<p>'.getValue($data['address_line_1']).'</p>'; ?>
                    <?php if(!empty($data['address_line_2'])) echo '<p>'.getValue($data['address_line_2']).'</p>'; ?>
                    <?php 
                        $cityState = array_filter([getValue($data['city']), getValue($data['state_province'])]);
                        if(!empty($cityState)) echo '<p>'.implode(', ', $cityState).'</p>'; 
                    ?>
                    <?php 
                        $zipCountry = array_filter([getValue($data['zip_code']), getValue($data['country'])]);
                        if(!empty($zipCountry)) echo '<p>'.implode(', ', $zipCountry).'</p>'; 
                    ?>
                    <?php if(!empty($data['email'])) echo '<p>'.getValue($data['email']).'</p>'; ?>
                </div>

                <div class="invoice-details">
                    <div class="detail-row">
                        <span class="detail-label">Invoice Date:</span>
                        <span class="detail-value"><?php echo $invoiceDate; ?></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Due Date:</span>
                        <span class="detail-value"><?php echo $dueDate; ?></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Amount:</span>
                        <span class="detail-value total-highlight">£<?php echo number_format($total, 2); ?></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Payment Status:</span>
                        <span class="detail-value">
                            <span class="payment-status-badge <?php echo $badgeClass; ?>"><?php echo $badgeText; ?></span>
                        </span>
                    </div>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: right;">Units</th>
                        <th style="text-align: right;">Price</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($items as $item): ?>
                    <tr>
                        <td>
                            <div class="item-name"><?php echo $item['name']; ?></div>
                            <div class="item-description"><?php echo $item['desc']; ?></div>
                        </td>
                        <td style="text-align: right;">1</td>
                        <td style="text-align: right;">£<?php echo number_format($item['price'], 2); ?></td>
                        <td style="text-align: right;">£<?php echo number_format($item['price'], 2); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>

            <div class="totals">
                <div class="total-row subtotal">
                    <span>Subtotal:</span>
                    <span>£<?php echo number_format($subtotal, 2); ?></span>
                </div>
                <?php if ($discountAmount > 0): ?>
                <div class="total-row discount">
                    <span><?php echo $discountLabel; ?>:</span>
                    <span>-£<?php echo number_format($discountAmount, 2); ?></span>
                </div>
                <?php endif; ?>
                <div class="total-row final">
                    <span>Total:</span>
                    <span>£<?php echo number_format($total, 2); ?></span>
                </div>
            </div>

            <div class="footer">
                

                <p>Thank you for Choosing VisaD!</p>
                <?php if ($isPaid): ?>
                    <p class="payment-received">Payment has been received. Thank you!</p>
                <?php else: ?>
                    <p>Please make payment within 7 days of receiving this invoice.</p>
                <?php endif; ?>
                <p>For any questions regarding this invoice, please contact us at support@visad.co.uk</p>
            </div>
        </div>
    </div>
</body>
</html>