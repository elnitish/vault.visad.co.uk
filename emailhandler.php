<?php
// LOCATION: api/email_handler.php
require 'db.php';

// Include Dompdf - adjust path based on your installation
// Option 1: Composer installation
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require __DIR__ . '/vendor/autoload.php';
}
// Option 2: Manual installation in dompdf folder
elseif (file_exists(__DIR__ . '/dompdf/autoload.inc.php')) {
    require __DIR__ . '/dompdf/autoload.inc.php';
}

use Dompdf\Dompdf;
use Dompdf\Options;

session_start();
header('Content-Type: application/json');

function is_loggedin() {
    if (isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === true) {
        return true;
    }
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Not authenticated']);
    return false;
}

if (!is_loggedin()) {
    exit;
}

$action = $_POST['action'] ?? '';

switch ($action) {
    case 'send_invoice':
        send_invoice_email($conn);
        break;
    case 'send_t_invoice':
        send_t_invoice_email($conn);
        break;
    default:
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
}

// --- HELPER: Fetch Invoice HTML Content ---
function fetch_invoice_content($record_id, $record_type, $created_at = '') {
    $url = "https://vault.visad.co.uk/view_invoice.php?id=" . $record_id . "&type=" . $record_type;

    $html = null;

    // Try cURL
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        $html = curl_exec($ch);
        curl_close($ch);
    }

    // Fallback
    if (!$html && ini_get('allow_url_fopen')) {
        $context = stream_context_create([
            "ssl" => [
                "verify_peer" => false,
                "verify_peer_name" => false,
            ],
        ]);
        $html = @file_get_contents($url, false, $context);
    }

    if ($html) {
        // Get plain text for extracting all values
        $plainText = strip_tags($html);
        $plainText = preg_replace('/\s+/', ' ', $plainText);
        
        // === EXTRACT ALL DATA ===
        $invoiceNumber = '';
        $invoiceDate = '';
        $dueDate = '';
        $totalAmount = '';
        $subtotal = '';
        $discount = '';
        $customerName = '';
        $customerAddress = '';
        $customerEmail = '';
        
        // Extract invoice number - try multiple patterns
        if (preg_match('/INV-(\d+)/i', $plainText, $m)) {
            $invoiceNumber = 'INV-' . $m[1];
        } elseif (preg_match('/Invoice\s*#?\s*:?\s*([A-Z]*-?\d+)/i', $plainText, $m)) {
            $invoiceNumber = trim($m[1]);
        } elseif (preg_match('/Invoice Number[:\s]*([^\s]+)/i', $plainText, $m)) {
            $invoiceNumber = trim($m[1]);
        }
        
        // === USE created_at FOR DATES ===
        if (!empty($created_at)) {
            // Parse created_at and format it
            $timestamp = strtotime($created_at);
            if ($timestamp !== false) {
                $invoiceDate = date('d M Y', $timestamp);
                // Due date = created_at + 7 days
                $dueDate = date('d M Y', strtotime('+7 days', $timestamp));
            } else {
                // Fallback to today if parsing fails
                $invoiceDate = date('d M Y');
                $dueDate = date('d M Y', strtotime('+7 days'));
            }
        } else {
            // Fallback: Extract dates from HTML (old behavior)
            if (preg_match('/Invoice Date:\s*(\d{1,2}\s*[A-Za-z]{3}\s*\d{4})/i', $plainText, $m)) {
                $invoiceDate = trim($m[1]);
            }
            if (preg_match('/Due Date:\s*(\d{1,2}\s*[A-Za-z]{3}\s*\d{4})/i', $plainText, $m)) {
                $dueDate = trim($m[1]);
            }
            // If still no dates, use today
            if (empty($invoiceDate)) {
                $invoiceDate = date('d M Y');
                $dueDate = date('d M Y', strtotime('+7 days'));
            }
        }
        
        // Extract amounts - try multiple patterns
        // Pattern 1: "Total Amount: £149.00" or "Total: £149.00"
        if (preg_match('/Total\s*(?:Amount)?[:\s]*£([\d,.]+)/i', $plainText, $m)) {
            $totalAmount = trim($m[1]);
        } elseif (preg_match('/Total[:\s]*[£€$]([\d,.]+)/i', $plainText, $m)) {
            $totalAmount = trim($m[1]);
        } elseif (preg_match('/£([\d,.]+)\s*(?:Payment|Status|PAID)/i', $plainText, $m)) {
            $totalAmount = trim($m[1]);
        }
        
        // Subtotal
        if (preg_match('/Subtotal[:\s]*£?([\d,.]+)/i', $plainText, $m)) {
            $subtotal = trim($m[1]);
        }
        
        // Discount
        if (preg_match('/Discount[^£€$\d]*[:\s]*-?£?([\d,.]+)/i', $plainText, $m)) {
            $discount = trim($m[1]);
        }
        
        // Extract customer email - find all emails, skip company ones
        if (preg_match_all('/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i', $plainText, $allEmails)) {
            foreach ($allEmails[1] as $email) {
                if (stripos($email, 'visad') === false && stripos($email, 'support') === false && stripos($email, 'info@') === false) {
                    $customerEmail = $email;
                    break;
                }
            }
        }
        
        // Extract Bill To section - everything between "Bill To" and next section marker
        if (preg_match('/Bill To[:\s]*(.+?)(?:Invoice Date|Description|Subtotal|Total|£\d)/is', $plainText, $m)) {
            $billToText = trim($m[1]);
            $billToText = preg_replace('/\s+/', ' ', $billToText);
            // Remove the email from billTo if present
            if ($customerEmail) {
                $billToText = str_replace($customerEmail, '', $billToText);
            }
            $customerAddress = trim($billToText);
        }
        
        // Extract customer name (first line after Bill To, usually in caps)
        if (preg_match('/Bill To[:\s]*([A-Z][A-Za-z\s]+?)(?:\d|,|[a-z]{3,})/i', $plainText, $m)) {
            $customerName = trim($m[1]);
        }
        
        // === EXTRACT TABLE DATA ===
        $tableRows = [];
        
        // Pattern 1: NAME - Package Type - Country followed by number and prices
        // Example: "NIKITHA NILE - Full Support Tourist - Germany 1 £149.00 £149.00"
        if (preg_match_all('/([A-Z][A-Z\s]+)\s*-\s*([A-Za-z\s]+)\s*-\s*([A-Za-z]+)\s*(\d+)\s*£?([\d,.]+)\s*£?([\d,.]+)/i', $plainText, $tableMatches, PREG_SET_ORDER)) {
            foreach ($tableMatches as $row) {
                $name = trim($row[1]);
                $package = trim($row[2]);
                $country = trim($row[3]);
                // Skip if this looks like header row
                if (stripos($name, 'Description') !== false || stripos($name, 'VISAD') !== false) continue;
                $tableRows[] = [
                    'description' => $name . ' - ' . $package . ' - ' . $country,
                    'qty' => trim($row[4]),
                    'price' => trim($row[5]),
                    'amount' => trim($row[6])
                ];
            }
        }
        
        // Pattern 2: Look for rows with description followed by 1, price, price
        if (empty($tableRows)) {
            if (preg_match_all('/([A-Z][A-Za-z\s\-]+(?:Tourist|Business|Student|Work|Visit|Support)[A-Za-z\s\-]*)\s+(\d+)\s+£?([\d,.]+)\s+£?([\d,.]+)/i', $plainText, $tableMatches, PREG_SET_ORDER)) {
                foreach ($tableMatches as $row) {
                    $desc = trim($row[1]);
                    if (stripos($desc, 'Description') !== false) continue;
                    $tableRows[] = [
                        'description' => $desc,
                        'qty' => trim($row[2]),
                        'price' => trim($row[3]),
                        'amount' => trim($row[4])
                    ];
                }
            }
        }
        
        // Pattern 3: Any text with "- " followed by number and two prices
        if (empty($tableRows)) {
            if (preg_match_all('/([A-Z][^\d£]+)\s+(\d+)\s+£([\d,.]+)\s+£([\d,.]+)/i', $plainText, $tableMatches, PREG_SET_ORDER)) {
                foreach ($tableMatches as $row) {
                    $desc = trim($row[1]);
                    // Skip headers and company info
                    if (stripos($desc, 'Description') !== false || stripos($desc, 'VISAD') !== false || stripos($desc, 'Bell Yard') !== false) continue;
                    $tableRows[] = [
                        'description' => $desc,
                        'qty' => trim($row[2]),
                        'price' => trim($row[3]),
                        'amount' => trim($row[4])
                    ];
                }
            }
        }
        
        // Pattern 4: Fallback - create from customer name and total if nothing else works
        if (empty($tableRows) && $customerName && $totalAmount) {
            $tableRows[] = [
                'description' => trim($customerName) . ' - Visa Service',
                'qty' => '1',
                'price' => $totalAmount,
                'amount' => $totalAmount
            ];
        }
        
        // === BUILD PROFESSIONAL HTML ===
        $output = '
<!-- Company Header -->
<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:20px; font-family:Arial,sans-serif;">
<tr>
<td style="vertical-align:top;">
<div style="font-size:32px; font-weight:800; letter-spacing:2px; margin-bottom:6px;">
<span style="color:#1e3a5f;">VISA</span><span style="color:#20c997;">D</span>
</div>
<div style="font-size:13px; color:#6c757d; line-height:1.6;">
7 Bell Yard<br>
London WC2A 2JR<br>
<a href="mailto:support@visad.co.uk" style="color:#20c997; text-decoration:none;">support@visad.co.uk</a>
</div>
</td>
<td style="text-align:right; vertical-align:top;">
<div style="font-size:28px; font-weight:700; color:#1e3a5f; margin-bottom:5px;">INVOICE</div>
<div style="display:inline-block; padding:8px 16px; background-color:#20c997; color:#ffffff; font-size:14px; font-weight:600; border-radius:4px;">' . htmlspecialchars($invoiceNumber) . '</div>
</td>
</tr>
</table>

<!-- Date & Status Cards -->
<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:20px; font-family:Arial,sans-serif;">
<tr>
<td style="width:24%; padding:12px 15px; background-color:#f8f9fa; border-radius:8px; vertical-align:top;">
<div style="font-size:10px; color:#6c757d; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">Invoice Date</div>
<div style="font-size:14px; color:#212529; font-weight:600;">' . htmlspecialchars($invoiceDate) . '</div>
</td>
<td style="width:2%;"></td>
<td style="width:24%; padding:12px 15px; background-color:#f8f9fa; border-radius:8px; vertical-align:top;">
<div style="font-size:10px; color:#6c757d; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">Due Date</div>
<div style="font-size:14px; color:#212529; font-weight:600;">' . htmlspecialchars($dueDate ?: $invoiceDate) . '</div>
</td>
<td style="width:2%;"></td>
<td style="width:24%; padding:12px 15px; background-color:#e8f5e9; border-radius:8px; vertical-align:top;">
<div style="font-size:10px; color:#155724; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">Amount</div>
<div style="font-size:18px; color:#155724; font-weight:700;">£' . htmlspecialchars($totalAmount) . '</div>
</td>
<td style="width:2%;"></td>
<td style="width:22%; padding:12px 15px; background-color:#28a745; border-radius:8px; text-align:center; vertical-align:middle;">
<div style="font-size:10px; color:rgba(255,255,255,0.8); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">Status</div>
<div style="font-size:16px; color:#ffffff; font-weight:700;">✓ PAID</div>
</td>
</tr>
</table>

<!-- Bill To Section -->
<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:20px; font-family:Arial,sans-serif;">
<tr>
<td style="padding:20px; background-color:#f8f9fa; border-radius:8px; border-left:4px solid #20c997;">
<div style="font-size:11px; color:#6c757d; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px; font-weight:600;">Bill To</div>
<div style="font-size:14px; color:#212529; line-height:1.6;">' . nl2br(htmlspecialchars($customerAddress)) . '</div>
<div style="margin-top:8px;"><a href="mailto:' . htmlspecialchars($customerEmail) . '" style="color:#20c997; text-decoration:none; font-size:14px;">' . htmlspecialchars($customerEmail) . '</a></div>
</td>
</tr>
</table>';

        // === ADD TABLE IF WE HAVE DATA ===
        if (!empty($tableRows)) {
            $output .= '
<!-- Items Table -->
<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:20px; font-family:Arial,sans-serif; border-collapse:collapse;">
<tr style="background-color:#1e3a5f;">
<th style="padding:12px 15px; text-align:left; font-weight:600; color:#ffffff; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; border-radius:8px 0 0 0;">Description</th>
<th style="padding:12px 15px; text-align:center; font-weight:600; color:#ffffff; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Units</th>
<th style="padding:12px 15px; text-align:right; font-weight:600; color:#ffffff; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Price</th>
<th style="padding:12px 15px; text-align:right; font-weight:600; color:#ffffff; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; border-radius:0 8px 0 0;">Amount</th>
</tr>';
            
            foreach ($tableRows as $row) {
                $output .= '
<tr>
<td style="padding:15px; color:#212529; font-size:14px; border-bottom:1px solid #e9ecef;">' . htmlspecialchars($row['description']) . '</td>
<td style="padding:15px; color:#212529; font-size:14px; border-bottom:1px solid #e9ecef; text-align:center;">' . htmlspecialchars($row['qty']) . '</td>
<td style="padding:15px; color:#212529; font-size:14px; border-bottom:1px solid #e9ecef; text-align:right;">£' . htmlspecialchars($row['price']) . '</td>
<td style="padding:15px; color:#212529; font-size:14px; border-bottom:1px solid #e9ecef; text-align:right; font-weight:600;">£' . htmlspecialchars($row['amount']) . '</td>
</tr>';
            }
            
            $output .= '</table>';
        }

        // === TOTALS SECTION ===
        if ($subtotal || $totalAmount) {
            // Extract discount percentage if available
            $discountPercent = '';
            if (preg_match('/Discount\s*\((\d+)%\)/i', $plainText, $m)) {
                $discountPercent = trim($m[1]);
            }
            
            $output .= '
<!-- Totals -->
<table cellpadding="0" cellspacing="0" border="0" style="width:280px; margin:0 0 25px auto; font-family:Arial,sans-serif;">
<tr>
<td style="padding:10px 15px; color:#6c757d; font-size:14px;">Subtotal</td>
<td style="padding:10px 15px; text-align:right; color:#212529; font-size:14px;">£' . htmlspecialchars($subtotal ?: $totalAmount) . '</td>
</tr>';
            
            if ($discount && floatval(str_replace(',', '', $discount)) > 0) {
                $discountLabel = $discountPercent ? 'Discount (' . $discountPercent . '%)' : 'Discount';
                $output .= '
<tr>
<td style="padding:10px 15px; color:#28a745; font-size:14px;">' . $discountLabel . '</td>
<td style="padding:10px 15px; text-align:right; color:#28a745; font-size:14px; font-weight:600;">-£' . htmlspecialchars($discount) . '</td>
</tr>';
            }
            
            $output .= '
<tr>
<td colspan="2" style="padding:5px 15px;"><div style="border-top:2px solid #20c997;"></div></td>
</tr>
<tr style="background-color:#f8f9fa;">
<td style="padding:12px 15px; color:#212529; font-size:16px; font-weight:700;">Total</td>
<td style="padding:12px 15px; text-align:right; color:#28a745; font-size:22px; font-weight:700;">£' . htmlspecialchars($totalAmount) . '</td>
</tr>
</table>';
        }

        // === THANK YOU MESSAGE ===
        $output .= '
<!-- Thank You -->
<table cellpadding="0" cellspacing="0" border="0" style="width:100%; font-family:Arial,sans-serif;">
<tr>
<td style="padding:20px; background-color:#e8f5e9; border-radius:8px; text-align:center;">
<div style="font-size:16px; font-weight:600; color:#155724;">Thank you for choosing VisaD!</div>
<div style="font-size:13px; color:#155724; margin-top:5px;">Payment has been received. Thank you!</div>
</td>
</tr>
</table>';

        return $output;
    }

    return $html;
}

// --- HELPER: Embed Images as Base64 ---
function embed_images_in_html($html) {
    return preg_replace_callback('/<img\s+[^>]*src=["\']([^"\']+)["\'][^>]*>/i', function($matches) {
        $img_tag = $matches[0];
        $url = $matches[1];
        
        if (strpos($url, 'data:') === 0 || empty($url)) return $img_tag;
        
        $img_data = false;
        if (function_exists('curl_init')) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $img_data = curl_exec($ch);
            curl_close($ch);
        } elseif (ini_get('allow_url_fopen')) {
             $img_data = @file_get_contents($url);
        }
        
        if ($img_data) {
            $ext = pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION);
            if (!$ext) $ext = 'png'; 
            $base64 = base64_encode($img_data);
            $new_src = "data:image/$ext;base64,$base64";
            return str_replace($url, $new_src, $img_tag);
        }
        return $img_tag;
    }, $html);
}

// --- HELPER: Convert HTML to PDF using Dompdf ---
function html_to_pdf($html) {
    // Check if Dompdf is available
    if (!class_exists('Dompdf\Dompdf')) {
        return false;
    }
    
    try {
        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', true);
        $options->set('defaultFont', 'Arial');
        
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        
        return $dompdf->output();
    } catch (Exception $e) {
        error_log("Dompdf error: " . $e->getMessage());
        return false;
    }
}

// --- SEND STANDARD INVOICE ---
function send_invoice_email($conn) {
    try {
        $record_id = $_POST['record_id'] ?? 0;
        $record_type = $_POST['record_type'] ?? 'traveler';
        $invoice_number = $_POST['invoice_number'] ?? '';
        $main_customer_name = $_POST['customer_name'] ?? '';
        $created_at = $_POST['created_at'] ?? '';
        $customer_email = $_POST['customer_email'] ?? '';
        $customer_address = $_POST['customer_address'] ?? '';
        
        // Get invoice data from POST
        $invoice_items = [];
        if (isset($_POST['invoice_items']) && !empty($_POST['invoice_items'])) {
            $decoded = json_decode($_POST['invoice_items'], true);
            if (is_array($decoded)) {
                $invoice_items = $decoded;
            }
        }
        
        // Debug logging
        error_log("INVOICE EMAIL DEBUG:");
        error_log("- invoice_items raw: " . ($_POST['invoice_items'] ?? 'NOT SET'));
        error_log("- invoice_items count: " . count($invoice_items));
        error_log("- subtotal: " . ($_POST['subtotal'] ?? 'NOT SET'));
        error_log("- total: " . ($_POST['total'] ?? 'NOT SET'));
        
        $subtotal = $_POST['subtotal'] ?? '0.00';
        $discount_amount = floatval($_POST['discount_amount'] ?? 0);
        $discount_percent = floatval($_POST['discount_percent'] ?? 0);
        $total = $_POST['total'] ?? '0.00';
        
        $emails = [];
        if (isset($_POST['emails']) && !empty($_POST['emails'])) {
            $decoded = json_decode($_POST['emails'], true);
            if (is_array($decoded)) $emails = $decoded;
        }
        if (empty($emails) && isset($_POST['email']) && !empty($_POST['email'])) {
            $emails = [$_POST['email']];
        }
        
        if (!$record_id || empty($emails)) {
            echo json_encode(['status' => 'error', 'message' => 'Missing required fields']);
            return;
        }
        
        $valid_emails = [];
        foreach ($emails as $email) {
            $email = trim($email);
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) $valid_emails[] = $email;
        }
        
        if (empty($valid_emails)) {
            echo json_encode(['status' => 'error', 'message' => 'No valid email addresses found']);
            return;
        }

        // === BUILD INVOICE CONTENT HTML ===
        // Format dates
        if (!empty($created_at)) {
            $timestamp = strtotime($created_at);
            if ($timestamp !== false) {
                $invoiceDate = date('d M Y', $timestamp);
                $dueDate = date('d M Y', strtotime('+7 days', $timestamp));
            } else {
                $invoiceDate = date('d M Y');
                $dueDate = date('d M Y', strtotime('+7 days'));
            }
        } else {
            $invoiceDate = date('d M Y');
            $dueDate = date('d M Y', strtotime('+7 days'));
        }
        
        $display_number = $invoice_number;
        
        // Calculate discount from subtotal and total if discount_amount is 0 but totals differ
        $subtotal_float = floatval($subtotal);
        $total_float = floatval($total);
        if ($discount_amount == 0 && $subtotal_float > $total_float) {
            $discount_amount = $subtotal_float - $total_float;
        }
        
        // Build invoice content HTML
        $invoice_html = '
<!-- Invoice Details Row -->
<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:20px; font-family:Arial,sans-serif; border:1px solid #e9ecef; border-radius:8px;">
<tr>
<td style="width:20%; padding:14px 15px; border-right:1px solid #e9ecef;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Invoice No.</div>
<div style="font-size:14px; color:#1e3a5f; font-weight:700;">' . htmlspecialchars($display_number) . '</div>
</td>
<td style="width:20%; padding:14px 15px; border-right:1px solid #e9ecef;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Invoice Date</div>
<div style="font-size:13px; color:#333333; font-weight:500;">' . htmlspecialchars($invoiceDate) . '</div>
</td>
<td style="width:20%; padding:14px 15px; border-right:1px solid #e9ecef;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Due Date</div>
<div style="font-size:13px; color:#333333; font-weight:500;">' . htmlspecialchars($dueDate) . '</div>
</td>
<td style="width:20%; padding:14px 15px; border-right:1px solid #e9ecef;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Amount Due</div>
<div style="font-size:16px; color:#1e3a5f; font-weight:700;">£' . htmlspecialchars($total) . '</div>
</td>
<td style="width:20%; padding:14px 15px; text-align:center;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Status</div>
<div style="display:inline-block; padding:5px 12px; background-color:#fff3cd; color:#856404; font-size:11px; font-weight:600; border-radius:20px;">PENDING</div>
</td>
</tr>
</table>

<!-- Bill To Section -->
<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:20px; font-family:Arial,sans-serif;">
<tr>
<td style="padding:16px 18px; background-color:#f8f9fa; border-radius:8px; border-left:3px solid #1e3a5f;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Bill To</div>
<div style="font-size:15px; color:#1e3a5f; font-weight:600; margin-bottom:5px;">' . htmlspecialchars($main_customer_name) . '</div>
<div style="font-size:13px; color:#555555; line-height:1.6;">' . htmlspecialchars($customer_address) . '</div>
<div style="margin-top:8px;">
<a href="mailto:' . htmlspecialchars($customer_email) . '" style="color:#20c997; text-decoration:none; font-size:13px;">' . htmlspecialchars($customer_email) . '</a>
</div>
</td>
</tr>
</table>';

        // === ADD ITEMS TABLE ===
        if (!empty($invoice_items)) {
            $invoice_html .= '
<!-- Items Table -->
<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:20px; font-family:Arial,sans-serif; border:1px solid #e5e5e5; border-radius:8px; border-collapse:separate;">
<tr>
<th style="padding:12px 15px; text-align:left; font-weight:600; color:#333333; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; background-color:#f9f9f9; border-bottom:1px solid #e5e5e5;">Description</th>
<th style="padding:12px 15px; text-align:center; font-weight:600; color:#333333; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; background-color:#f9f9f9; border-bottom:1px solid #e5e5e5; width:60px;">Units</th>
<th style="padding:12px 15px; text-align:right; font-weight:600; color:#333333; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; background-color:#f9f9f9; border-bottom:1px solid #e5e5e5; width:80px;">Price</th>
<th style="padding:12px 15px; text-align:right; font-weight:600; color:#333333; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; background-color:#f9f9f9; border-bottom:1px solid #e5e5e5; width:80px;">Amount</th>
</tr>';
            
            foreach ($invoice_items as $item) {
                $itemName = $item['name'] ?? 'Service';
                $itemPackage = $item['package'] ?? '';
                $itemVisaType = $item['visa_type'] ?? '';
                $itemCountry = $item['country'] ?? '';
                $itemPrice = $item['price'] ?? '0.00';
                
                // Build description
                $description = $itemName;
                if ($itemPackage) $description .= ' - ' . $itemPackage;
                if ($itemVisaType) $description .= ' ' . $itemVisaType;
                if ($itemCountry) $description .= ' - ' . $itemCountry;
                
                $invoice_html .= '
<tr>
<td style="padding:14px 15px; color:#333333; font-size:13px;">' . htmlspecialchars($description) . '</td>
<td style="padding:14px 15px; color:#333333; font-size:13px; text-align:center;">1</td>
<td style="padding:14px 15px; color:#333333; font-size:13px; text-align:right;">£' . htmlspecialchars($itemPrice) . '</td>
<td style="padding:14px 15px; color:#333333; font-size:13px; text-align:right; font-weight:600;">£' . htmlspecialchars($itemPrice) . '</td>
</tr>';
            }
            
            $invoice_html .= '</table>';
        }

        // === TOTALS SECTION ===
        $invoice_html .= '
<!-- Totals -->
<table cellpadding="0" cellspacing="0" border="0" style="width:240px; margin:0 0 25px auto; font-family:Arial,sans-serif;">
<tr>
<td style="padding:8px 0; color:#888888; font-size:13px;">Subtotal</td>
<td style="padding:8px 0; text-align:right; color:#333333; font-size:13px;">£' . htmlspecialchars($subtotal) . '</td>
</tr>';
        
        // Add discount row if applicable
        if ($discount_amount > 0) {
            $discountLabel = $discount_percent > 0 ? 'Discount (' . intval($discount_percent) . '%)' : 'Discount';
            $invoice_html .= '
<tr>
<td style="padding:8px 0; color:#20c997; font-size:13px;">' . $discountLabel . '</td>
<td style="padding:8px 0; text-align:right; color:#20c997; font-size:13px; font-weight:600;">-£' . number_format($discount_amount, 2) . '</td>
</tr>';
        }
        
        $invoice_html .= '
<tr>
<td colspan="2" style="padding:8px 0;"><div style="border-top:1px solid #e5e5e5;"></div></td>
</tr>
<tr>
<td style="padding:10px 0; color:#333333; font-size:14px; font-weight:600;">Total</td>
<td style="padding:10px 0; text-align:right; color:#1e3a5f; font-size:20px; font-weight:700;">£' . htmlspecialchars($total) . '</td>
</tr>
</table>';
        
        $subject = "Invoice $invoice_number - VISAD.CO.UK";
        
        $smtp_host = 'mail.visad.co.uk';
        $smtp_user = 'info@visad.co.uk';
        $smtp_pass = 'Wearestarshere*';
        $smtp_port = 465;

        $sent_count = 0;
        $failed_emails = [];
        
        // Send to each recipient
        foreach ($valid_emails as $to_email) {
            // Create personalized email message
            $message = '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:Arial,sans-serif;">
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
        <tr>
            <td align="center" style="padding:40px 20px;">
                
                <!-- Email Container -->
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    
                    <!-- Header with Logo -->
                    <tr>
                        <td style="padding:35px 40px 25px 40px; text-align:center; border-bottom:1px solid #eee;">
                            <span style="font-size:32px; font-weight:800; letter-spacing:1px; color:#1e3a5f;">VISA</span><span style="font-size:32px; font-weight:800; letter-spacing:1px; color:#20c997;">D</span>
                            <p style="margin:8px 0 0 0; font-size:12px; color:#888888;">iWeBron Limited, 7 Bell Yard, London WC2A 2JR</p>
                        </td>
                    </tr>
                    
                    <!-- Invoice Badge -->
                    <tr>
                        <td style="padding:30px 40px 20px 40px; text-align:center;">
                            <div style="display:inline-block; background-color:#e7f3ff; border:1px solid #b8daff; border-radius:50px; padding:12px 30px;">
                                <span style="font-size:16px; font-weight:600; color:#004085;">📄 Invoice</span>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Greeting -->
                    <tr>
                        <td style="padding:10px 40px 25px 40px;">
                            <p style="margin:0 0 12px 0; font-size:18px; color:#1e3a5f; font-weight:600;">
                                Dear ' . htmlspecialchars($main_customer_name) . ',
                            </p>
                            <p style="margin:0; font-size:15px; color:#555555; line-height:1.7;">
                                Thank you for choosing VISAD. Please find your invoice details below.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Invoice Content -->
                    <tr>
                        <td style="padding:0 40px 35px 40px;">
                            ' . $invoice_html . '
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding:25px 40px; background-color:#f8f9fa; border-top:1px solid #eee; text-align:center; border-radius:0 0 12px 12px;">
                            <p style="margin:0 0 8px 0; font-size:13px; color:#666666;">Need help? Contact us at <a href="mailto:support@visad.co.uk" style="color:#20c997; text-decoration:none;">support@visad.co.uk</a></p>
                            <p style="margin:0; font-size:12px; color:#999999;"><a href="https://www.visad.co.uk" style="color:#1e3a5f; text-decoration:none; font-weight:600;">www.visad.co.uk</a></p>
                        </td>
                    </tr>
                    
                </table>
                
            </td>
        </tr>
    </table>
    
</body>
</html>';
            
            $sent = sendSMTP($to_email, $subject, $message, $smtp_host, $smtp_user, $smtp_pass, $smtp_port, null, null, null, null);
            if ($sent === true) {
                $sent_count++;
                $stmt = $conn->prepare("INSERT INTO invoice_history (record_id, record_type, invoice_type, invoice_number, sent_to_email) VALUES (?, ?, 'invoice', ?, ?)");
                if ($stmt) {
                    $stmt->bind_param("isss", $record_id, $record_type, $invoice_number, $to_email);
                    $stmt->execute();
                    $stmt->close();
                }
            } else {
                $failed_emails[] = $to_email;
            }
        }
        
        if (function_exists('log_change') && $sent_count > 0) {
            log_change($conn, $record_type, $record_id, $main_customer_name, 'Invoice Email Sent (HTML)', '', implode(', ', $valid_emails));
        }
        
        if ($sent_count === count($valid_emails)) {
            echo json_encode(['status' => 'success', 'message' => "Invoice sent to $sent_count recipients"]);
        } else {
            echo json_encode(['status' => 'partial', 'message' => "Sent to $sent_count. Failed: " . implode(', ', $failed_emails)]);
        }
        
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Error: ' . $e->getMessage()]);
    }
}

// --- SEND TAX INVOICE (T-INVOICE) ---
function send_t_invoice_email($conn) {
    try {
        $record_id = $_POST['record_id'] ?? 0;
        $record_type = $_POST['record_type'] ?? 'traveler';
        $invoice_number = $_POST['invoice_number'] ?? '';
        $main_customer_name = $_POST['customer_name'] ?? '';
        $created_at = $_POST['created_at'] ?? '';
        $customer_email = $_POST['customer_email'] ?? '';
        $customer_address = $_POST['customer_address'] ?? '';
        
        // Get invoice data from POST
        $invoice_items = [];
        if (isset($_POST['invoice_items']) && !empty($_POST['invoice_items'])) {
            $decoded = json_decode($_POST['invoice_items'], true);
            if (is_array($decoded)) {
                $invoice_items = $decoded;
            }
        }
        
        $subtotal = $_POST['subtotal'] ?? '0.00';
        $discount_amount = floatval($_POST['discount_amount'] ?? 0);
        $discount_percent = floatval($_POST['discount_percent'] ?? 0);
        $total = $_POST['total'] ?? '0.00';
        
        // Debug logging
        error_log("T-Invoice Discount: amount={$discount_amount}, percent={$discount_percent}, subtotal={$subtotal}, total={$total}");
        
        // Get applicants array (new format) or fall back to emails array
        $applicants = [];
        if (isset($_POST['applicants']) && !empty($_POST['applicants'])) {
            $decoded = json_decode($_POST['applicants'], true);
            if (is_array($decoded)) {
                $applicants = $decoded;
            }
        }
        
        // Fallback: If no applicants array, use emails array with main customer name
        if (empty($applicants)) {
            $emails = [];
            if (isset($_POST['emails']) && !empty($_POST['emails'])) {
                $decoded = json_decode($_POST['emails'], true);
                if (is_array($decoded)) $emails = $decoded;
            }
            if (empty($emails) && isset($_POST['email']) && !empty($_POST['email'])) {
                $emails = [$_POST['email']];
            }
            
            // Convert emails to applicants format
            foreach ($emails as $email) {
                $applicants[] = [
                    'name' => $main_customer_name,
                    'email' => $email,
                    'type' => 'Applicant'
                ];
            }
        }
        
        if (!$record_id || empty($applicants)) {
            echo json_encode(['status' => 'error', 'message' => 'Missing required fields']);
            return;
        }
        
        // Validate all applicant emails
        $valid_applicants = [];
        foreach ($applicants as $applicant) {
            $email = trim($applicant['email'] ?? '');
            $name = trim($applicant['name'] ?? 'Customer');
            $type = $applicant['type'] ?? 'Applicant';
            
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $valid_applicants[] = [
                    'name' => $name,
                    'email' => $email,
                    'type' => $type
                ];
            }
        }
        
        if (empty($valid_applicants)) {
            echo json_encode(['status' => 'error', 'message' => 'No valid email addresses found']);
            return;
        }
        
        // === BUILD INVOICE CONTENT HTML ===
        $display_number = preg_replace('/^T-/', '', $invoice_number);
        
        // Format dates
        if (!empty($created_at)) {
            $timestamp = strtotime($created_at);
            if ($timestamp !== false) {
                $invoiceDate = date('d M Y', $timestamp);
                $dueDate = date('d M Y', strtotime('+7 days', $timestamp));
            } else {
                $invoiceDate = date('d M Y');
                $dueDate = date('d M Y', strtotime('+7 days'));
            }
        } else {
            $invoiceDate = date('d M Y');
            $dueDate = date('d M Y', strtotime('+7 days'));
        }
        
        // Build emails list from all valid applicants
        $all_emails_html = '';
        foreach ($valid_applicants as $applicant) {
            $all_emails_html .= '<a href="mailto:' . htmlspecialchars($applicant['email']) . '" style="color:#20c997; text-decoration:none; font-size:13px;">' . htmlspecialchars($applicant['email']) . '</a>';
            if ($applicant !== end($valid_applicants)) {
                $all_emails_html .= ' | ';
            }
        }
        
        // Build invoice content HTML
        $invoice_html = '
<!-- Invoice Details Row -->
<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:20px; font-family:Arial,sans-serif; border:1px solid #e9ecef; border-radius:8px;">
<tr>
<td style="width:20%; padding:14px 15px; border-right:1px solid #e9ecef;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Invoice No.</div>
<div style="font-size:14px; color:#1e3a5f; font-weight:700;">' . htmlspecialchars($display_number) . '</div>
</td>
<td style="width:20%; padding:14px 15px; border-right:1px solid #e9ecef;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Invoice Date</div>
<div style="font-size:13px; color:#333333; font-weight:500;">' . htmlspecialchars($invoiceDate) . '</div>
</td>
<td style="width:20%; padding:14px 15px; border-right:1px solid #e9ecef;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Payment Date</div>
<div style="font-size:13px; color:#333333; font-weight:500;">' . htmlspecialchars($invoiceDate) . '</div>
</td>
<td style="width:20%; padding:14px 15px; border-right:1px solid #e9ecef;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Amount Paid</div>
<div style="font-size:16px; color:#1e3a5f; font-weight:700;">£' . htmlspecialchars($total) . '</div>
</td>
<td style="width:20%; padding:14px 15px; text-align:center;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Status</div>
<div style="display:inline-block; padding:5px 12px; background-color:#d4edda; color:#155724; font-size:11px; font-weight:600; border-radius:20px;">✓ PAID</div>
</td>
</tr>
</table>

<!-- Bill To Section -->
<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:20px; font-family:Arial,sans-serif;">
<tr>
<td style="padding:16px 18px; background-color:#f8f9fa; border-radius:8px; border-left:3px solid #20c997;">
<div style="font-size:10px; color:#888888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Bill To</div>
<div style="font-size:15px; color:#1e3a5f; font-weight:600; margin-bottom:5px;">' . htmlspecialchars($main_customer_name) . '</div>
<div style="font-size:13px; color:#555555; line-height:1.6;">' . htmlspecialchars($customer_address) . '</div>
<div style="margin-top:8px;">' . $all_emails_html . '</div>
</td>
</tr>
</table>';

        // === ADD ITEMS TABLE ===
        if (!empty($invoice_items)) {
            $invoice_html .= '
<!-- Items Table -->
<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:20px; font-family:Arial,sans-serif; border:1px solid #e5e5e5; border-radius:8px; border-collapse:separate;">
<tr>
<th style="padding:12px 15px; text-align:left; font-weight:600; color:#333333; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; background-color:#f9f9f9; border-bottom:1px solid #e5e5e5;">Description</th>
<th style="padding:12px 15px; text-align:center; font-weight:600; color:#333333; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; background-color:#f9f9f9; border-bottom:1px solid #e5e5e5; width:60px;">Units</th>
<th style="padding:12px 15px; text-align:right; font-weight:600; color:#333333; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; background-color:#f9f9f9; border-bottom:1px solid #e5e5e5; width:80px;">Price</th>
<th style="padding:12px 15px; text-align:right; font-weight:600; color:#333333; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; background-color:#f9f9f9; border-bottom:1px solid #e5e5e5; width:80px;">Amount</th>
</tr>';
            
            foreach ($invoice_items as $item) {
                $itemName = $item['name'] ?? 'Service';
                $itemPackage = $item['package'] ?? '';
                $itemVisaType = $item['visa_type'] ?? '';
                $itemCountry = $item['country'] ?? '';
                $itemPrice = $item['price'] ?? '0.00';
                
                // Build description
                $description = $itemName;
                if ($itemPackage) $description .= ' - ' . $itemPackage;
                if ($itemVisaType) $description .= ' ' . $itemVisaType;
                if ($itemCountry) $description .= ' - ' . $itemCountry;
                
                $invoice_html .= '
<tr>
<td style="padding:14px 15px; color:#333333; font-size:13px;">' . htmlspecialchars($description) . '</td>
<td style="padding:14px 15px; color:#333333; font-size:13px; text-align:center;">1</td>
<td style="padding:14px 15px; color:#333333; font-size:13px; text-align:right;">£' . htmlspecialchars($itemPrice) . '</td>
<td style="padding:14px 15px; color:#333333; font-size:13px; text-align:right; font-weight:600;">£' . htmlspecialchars($itemPrice) . '</td>
</tr>';
            }
            
            $invoice_html .= '</table>';
        }

        // === TOTALS SECTION ===
        // Debug: Log what we received
        error_log("T-Invoice Totals: subtotal={$subtotal}, discount_amount={$discount_amount}, discount_percent={$discount_percent}, total={$total}");
        
        // Calculate discount from subtotal and total if discount_amount is 0 but totals differ
        $subtotal_float = floatval($subtotal);
        $total_float = floatval($total);
        if ($discount_amount == 0 && $subtotal_float > $total_float) {
            $discount_amount = $subtotal_float - $total_float;
            error_log("T-Invoice: Calculated discount from difference: {$discount_amount}");
        }
        
        $invoice_html .= '
<!-- Totals -->
<table cellpadding="0" cellspacing="0" border="0" style="width:240px; margin:0 0 25px auto; font-family:Arial,sans-serif;">
<tr>
<td style="padding:8px 0; color:#888888; font-size:13px;">Subtotal</td>
<td style="padding:8px 0; text-align:right; color:#333333; font-size:13px;">£' . htmlspecialchars($subtotal) . '</td>
</tr>';
        
        // Add discount row if applicable
        if ($discount_amount > 0) {
            $discountLabel = $discount_percent > 0 ? 'Discount (' . intval($discount_percent) . '%)' : 'Discount';
            $invoice_html .= '
<tr>
<td style="padding:8px 0; color:#20c997; font-size:13px;">' . $discountLabel . '</td>
<td style="padding:8px 0; text-align:right; color:#20c997; font-size:13px; font-weight:600;">-£' . number_format($discount_amount, 2) . '</td>
</tr>';
        }
        
        $invoice_html .= '
<tr>
<td colspan="2" style="padding:8px 0;"><div style="border-top:1px solid #e5e5e5;"></div></td>
</tr>
<tr>
<td style="padding:10px 0; color:#333333; font-size:14px; font-weight:600;">Total</td>
<td style="padding:10px 0; text-align:right; color:#1e3a5f; font-size:20px; font-weight:700;">£' . htmlspecialchars($total) . '</td>
</tr>
</table>';
        
        // Use subject from POST data if provided, otherwise use default
        $subject = isset($_POST['subject']) && !empty($_POST['subject']) 
            ? $_POST['subject'] 
            : "Payment Confirmation - $display_number";
        
        // Use BCC from POST data if provided, otherwise use default
        $trustpilot_bcc = isset($_POST['bcc']) && !empty($_POST['bcc']) 
            ? $_POST['bcc'] 
            : 'visad.co.uk+5e14bff186@invite.trustpilot.com';
        
        $smtp_host = 'mail.visad.co.uk';
        $smtp_user = 'info@visad.co.uk';
        $smtp_pass = 'Wearestarshere*';
        $smtp_port = 465;

        $sent_count = 0;
        $failed_emails = [];
        
        // Send SEPARATE personalized email to EACH applicant
        foreach ($valid_applicants as $index => $applicant) {
            $applicant_name = $applicant['name'];
            $applicant_email = $applicant['email'];
            
            // Add BCC to ALL emails
            $bcc = $trustpilot_bcc;
            
            // Create personalized email message for THIS applicant
            $message = '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmation</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:Arial,sans-serif;">
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
        <tr>
            <td align="center" style="padding:40px 20px;">
                
                <!-- Email Container -->
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    
                    <!-- Header with Logo -->
                    <tr>
                        <td style="padding:35px 40px 25px 40px; text-align:center; border-bottom:1px solid #eee;">
                            <span style="font-size:32px; font-weight:800; letter-spacing:0.5px; color:#1e3a5f;">VISA</span><span style="font-size:32px; font-weight:800; letter-spacing:0.5px; color:#20c997;">D</span>
                            <p style="margin:8px 0 0 0; font-size:12px; color:#888888;">iWeBron Limited, 7 Bell Yard, London WC2A 2JR</p>
                        </td>
                    </tr>
                    
                    <!-- Success Badge -->
                    <tr>
                        <td style="padding:30px 40px 20px 40px; text-align:center;">
                            <div style="display:inline-block; background-color:#d4edda; border:1px solid #c3e6cb; border-radius:50px; padding:12px 30px;">
                                <span style="font-size:16px; font-weight:600; color:#155724;">✓ Payment Confirmed</span>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Greeting -->
                    <tr>
                        <td style="padding:10px 40px 25px 40px;">
                            <p style="margin:0 0 12px 0; font-size:18px; color:#1e3a5f; font-weight:600;">
                                Dear ' . htmlspecialchars($applicant_name) . ',
                            </p>
                            <p style="margin:0; font-size:14px; color:#555555; line-height:1.7;">
                                Thank you for choosing VISAD. Your payment has been successfully received and processed.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Invoice Content -->
                    <tr>
                        <td style="padding:0 40px 35px 40px;">
                            ' . $invoice_html . '
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding:25px 40px; background-color:#f8f9fa; border-top:1px solid #eee; text-align:center; border-radius:0 0 12px 12px;">
                            <p style="margin:0 0 8px 0; font-size:13px; color:#666666;">Need help? Contact us at <a href="mailto:support@visad.co.uk" style="color:#20c997; text-decoration:none;">support@visad.co.uk</a></p>
                            <p style="margin:0; font-size:12px; color:#999999;"><a href="https://www.visad.co.uk" style="color:#1e3a5f; text-decoration:none; font-weight:600;">www.visad.co.uk</a></p>
                        </td>
                    </tr>
                    
                </table>
                
            </td>
        </tr>
    </table>
    
</body>
</html>';
            
            // Send personalized email to this applicant
            $sent = sendSMTP($applicant_email, $subject, $message, $smtp_host, $smtp_user, $smtp_pass, $smtp_port, $bcc, null, null, null);
            
            if ($sent === true) {
                $sent_count++;
                $stmt = $conn->prepare("INSERT INTO invoice_history (record_id, record_type, invoice_type, invoice_number, sent_to_email) VALUES (?, ?, 't-invoice', ?, ?)");
                if ($stmt) {
                    $stmt->bind_param("isss", $record_id, $record_type, $invoice_number, $applicant_email);
                    $stmt->execute();
                    $stmt->close();
                }
            } else {
                $failed_emails[] = $applicant_email;
            }
        }
        
        if (function_exists('log_change') && $sent_count > 0) {
            $log_action = 'T-Invoice Email Sent (HTML) - Separate emails to each applicant';
            $all_emails = array_column($valid_applicants, 'email');
            log_change($conn, $record_type, $record_id, $main_customer_name, $log_action, '', implode(', ', $all_emails));
        }
        
        if ($sent_count === count($valid_applicants)) {
            $msg = $sent_count > 1 
                ? "T-Invoice sent separately to $sent_count applicants" 
                : "T-Invoice sent to 1 recipient";
            echo json_encode(['status' => 'success', 'message' => $msg]);
        } else {
            echo json_encode(['status' => 'partial', 'message' => "Sent to $sent_count. Failed: " . implode(', ', $failed_emails)]);
        }
        
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Error: ' . $e->getMessage()]);
    }
}

// --- SMTP FUNCTION WITH ATTACHMENT SUPPORT (HTML or PDF) ---
function sendSMTP($to, $subject, $message, $host, $user, $pass, $port, $bcc = null, $attachmentData = null, $attachmentName = null, $attachmentType = 'html') {
    $timeout = 5; // Reduced to 5 seconds for faster connection
    $localhost = $_SERVER['SERVER_NAME'];
    $newLine = "\r\n";
    
    $smtp_conn = fsockopen("ssl://".$host, $port, $errno, $errstr, $timeout);
    
    if(empty($smtp_conn)) {
        return "Connection failed: $errno - $errstr";
    }
    
    // Set stream timeout for read operations (2 seconds)
    stream_set_timeout($smtp_conn, 2);
    
    $send_cmd = function($conn, $cmd, $expected_code) {
        fputs($conn, $cmd . "\r\n");
        $response = "";
        while ($str = fgets($conn, 515)) {
            $response .= $str;
            if (substr($str, 3, 1) == " ") { break; }
        }
        if (substr($response, 0, 3) != $expected_code) {
            return "Error on '$cmd': $response";
        }
        return true;
    };

    $data = "";
    while ($str = fgets($smtp_conn, 515)) {
        $data .= $str;
        if (substr($str, 3, 1) == " ") { break; }
    }

    if (($res = $send_cmd($smtp_conn, "EHLO $localhost", '250')) !== true) return $res;
    if (($res = $send_cmd($smtp_conn, "AUTH LOGIN", '334')) !== true) return $res;
    if (($res = $send_cmd($smtp_conn, base64_encode($user), '334')) !== true) return $res;
    if (($res = $send_cmd($smtp_conn, base64_encode($pass), '235')) !== true) return "Auth Failed: " . $res;
    if (($res = $send_cmd($smtp_conn, "MAIL FROM: <$user>", '250')) !== true) return $res;
    if (($res = $send_cmd($smtp_conn, "RCPT TO: <$to>", '250')) !== true) return $res;
    if ($bcc) $send_cmd($smtp_conn, "RCPT TO: <$bcc>", '250');
    if (($res = $send_cmd($smtp_conn, "DATA", '354')) !== true) return $res;

    $boundary = "----=_NextPart_" . md5(uniqid(time()));
    
    $headers = "MIME-Version: 1.0" . $newLine;
    $headers .= "From: VISAD.CO.UK <$user>" . $newLine;
    $headers .= "To: $to" . $newLine;
    $headers .= "Reply-To: $user" . $newLine;
    $headers .= "Subject: $subject" . $newLine;
    
    if ($attachmentData !== null && !empty($attachmentData)) {
        $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"" . $newLine;
        
        $body = "This is a multi-part message in MIME format." . $newLine;
        
        $body .= "--$boundary" . $newLine;
        $body .= "Content-Type: text/html; charset=UTF-8" . $newLine;
        $body .= "Content-Transfer-Encoding: base64" . $newLine . $newLine;
        $body .= chunk_split(base64_encode($message)) . $newLine;
        
        $body .= "--$boundary" . $newLine;
        
        if ($attachmentType === 'pdf') {
            $body .= "Content-Type: application/pdf; name=\"$attachmentName\"" . $newLine;
            $body .= "Content-Disposition: attachment; filename=\"$attachmentName\"" . $newLine;
            $body .= "Content-Transfer-Encoding: base64" . $newLine . $newLine;
            $body .= chunk_split(base64_encode($attachmentData)) . $newLine;
        } else {
            $body .= "Content-Type: text/html; name=\"$attachmentName\"" . $newLine;
            $body .= "Content-Disposition: attachment; filename=\"$attachmentName\"" . $newLine;
            $body .= "Content-Transfer-Encoding: base64" . $newLine . $newLine;
            $body .= chunk_split(base64_encode($attachmentData)) . $newLine;
        }
        
        $body .= "--$boundary--" . $newLine;
        
    } else {
        $headers .= "Content-Type: text/html; charset=UTF-8" . $newLine;
        $headers .= "Content-Transfer-Encoding: base64" . $newLine;
        $body = chunk_split(base64_encode($message));
    }
    
    fputs($smtp_conn, $headers . $newLine . $body . $newLine . "." . $newLine);
    
    $response = "";
    while ($str = fgets($smtp_conn, 515)) {
        $response .= $str;
        if (substr($str, 3, 1) == " ") { break; }
    }
    
    fputs($smtp_conn, "QUIT" . $newLine);
    fclose($smtp_conn);

    if (substr($response, 0, 3) != '250') {
        return "Message Rejected: $response";
    }

    return true;
}

$conn->close();
?>