// Add this JavaScript code BEFORE the closing </script> tag in app.html
// Replace the existing addNotification function and add these new functions

// Filter notifications by destination and time
function filterNotifications(destination = null) {
    currentDestinationFilter = destination;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    let filtered = allNotifications;

    // If "All Destinations" selected, show only last 24 hours
    if (!destination) {
        filtered = filtered.filter(n => (now - n.timestamp) <= twentyFourHours);
    } else {
        // Filter by destination (show all time for specific destination)
        filtered = filtered.filter(n => n.country === destination);
    }

    // Render filtered notifications
    renderNotifications(filtered);
}

// Render notifications to the DOM
function renderNotifications(notifications) {
    const $list = $('#notif-list');
    $list.empty();

    if (notifications.length === 0) {
        $list.html(`
            <div class="notif-empty">
                <i class="fas fa-inbox"></i>
                <p>${currentDestinationFilter ? 'No notifications for this destination' : 'No notifications in last 24 hours'}</p>
            </div>
        `);
        return;
    }

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => b.timestamp - a.timestamp);

    // Render each notification
    notifications.forEach(notif => {
        const isKeywordMatch = notif.isKeywordMatch;
        const keywordBadge = isKeywordMatch
            ? `<span class="notif-keyword"><i class="fas fa-star"></i> ${notif.keyword}</span>`
            : '';

        const $notif = $(`
            <div class="notif-item ${isKeywordMatch ? 'keyword-match' : ''}" data-timestamp="${notif.timestamp}">
                <div class="notif-item-header">
                    <span class="notif-sender">${notif.sender || 'Unknown'}</span>
                    <span class="notif-time">${formatTime(notif.timestamp)}</span>
                </div>
                <div class="notif-group">
                    <i class="fas fa-users"></i>
                    ${notif.group || 'Unknown Group'}
                </div>
                <div class="notif-message">${notif.message || ''}</div>
                ${keywordBadge}
            </div>
        `);

        $list.append($notif);
    });

    // Update count
    $('#notif-count').text(notifications.length);
}

// REPLACE the existing addNotification function with this:
function addNotification(data) {
    // Extract country from message
    const country = extractCountryFromMessage(data.message);

    // Create notification object with metadata
    const notification = {
        sender: data.sender || 'Unknown',
        group: data.group || 'Unknown Group',
        message: data.message || '',
        keyword: data.keyword || '',
        isKeywordMatch: !!data.isKeywordMatch,
        timestamp: data.timestamp || Date.now(),
        country: country
    };

    // Add to storage
    allNotifications.unshift(notification);

    // Keep only last 200 notifications in storage
    if (allNotifications.length > 200) {
        allNotifications = allNotifications.slice(0, 200);
    }

    // Re-filter and render
    filterNotifications(currentDestinationFilter);

    // Visual feedback for new notification
    if (notification.isKeywordMatch) {
        setTimeout(() => {
            const $newItem = $('.notif-item').first();
            $newItem.css('animation', 'slideIn 0.3s ease, pulse 0.5s ease 0.3s');
        }, 100);
    }
}

// Hook into destination filter clicks
$(document).on('click', '.dest-item', function() {
    const country = $(this).data('country');
    const filterType = $(this).data('filter');

    if (filterType === 'all') {
        // All Destinations - show last 24 hours
        filterNotifications(null);
    } else {
        // Specific destination - show all notifications for that country
        filterNotifications(country);
    }
});
