import { Injectable } from '@angular/core';

@Injectable()
export class Define {

    static materialIcons = [
    // Action
    'accessibility', 'accessible', 'account_balance', 'account_box', 'account_circle', 'alarm', 'alarm_add', 'alarm_off', 
    'alarm_on', 'all_out', 'android', 'announcement', 'aspect_ratio', 'assessment', 'assignment', 'assignment_ind', 'assignment_late', 
    'assignment_return', 'assignment_returned', 'assignment_turned_in', 'autorenew', 'backup', 'book', 'bookmark', 'bookmark_border', 'bug_report', 'build', 
    'cached', 'camera_enhance', 'change_history', 'check_circle', 'check_circle_outline', 'chrome_reader_mode', 'class', 'code', 
    'compare_arrows', 'copyright', 'credit_card', 'dashboard', 'delete', 'delete_outline', 'description', 'dns', 
    'done', 'done_all', 'done_outline', 'donut_large', 'donut_small', 'eject', 'euro_symbol', 'event', 'event_seat', 'exit_to_app', 
    'explore', 'extension', 'face', 'favorite', 'favorite_border', 'feedback', 'find_in_page', 'find_replace', 'fingerprint', 'flight_land', 'flight_takeoff', 
    'flip_to_back', 'flip_to_front', 'gavel', 'get_app', 'gif', 'grade', 'group_work', 'help', 'help_outline', 'highlight_off', 'history', 
    'home', 'hourglass_empty', 'hourglass_full', 'important_devices', 'info', 'input', 'invert_colors', 'label',  
    'language', 'launch', 'list', 'lock', 'lock_open', 'loyalty', 'markunread_mailbox', 'motorcycle', 'note_add', 'offline_pin', 
    'opacity', 'open_in_browser', 'open_with', 'pageview', 'pan_tool', 'perm_camera_mic', 'perm_contact_calendar', 'perm_data_setting', 'perm_device_information', 'perm_identity', 'perm_media', 
    'perm_phone_msg', 'perm_scan_wifi', 'pets', 'picture_in_picture', 'play_for_work', 'polymer', 'power_settings_new', 'print', 'query_builder', 
    'question_answer', 'receipt', 'record_voice_over', 'reorder', 'report_problem', 'restore_page', 'room', 'rowing', 'search', 'settings', 
    'settings_applications', 'settings_backup_restore', 'settings_bluetooth', 'settings_brightness', 'settings_cell', 'settings_ethernet', 
    'settings_input_antenna', 'settings_input_component', 'settings_input_hdmi', 'settings_input_svideo', 
    'settings_overscan', 'settings_phone', 'settings_power', 'settings_remote', 'settings_voice', 'shop', 'shopping_basket', 'shopping_cart', 'speaker_notes', 'spellcheck', 
    'stars', 'store', 'subject', 'supervisor_account', 'swap_horiz', 'swap_horizontal_circle', 'swap_vert', 'swap_vertical_circle', 'tab', 
    'tab_unselected', 'theaters', 'thumb_down', 'thumb_up', 'thumbs_up_down', 'timeline', 'toc', 'toll', 'touch_app', 'track_changes', 
    'trending_down', 'trending_flat', 'trending_up', 'verified_user', 'view_agenda', 'view_array', 'view_carousel', 'view_column', 'view_day', 
    'view_list', 'view_module', 'view_quilt', 'view_stream', 'view_week', 'visibility', 'visibility_off', 'watch_later', 'work', 
    'zoom_in', 'zoom_out', 
    // Alert
    'add_alert', 'error', 'error_outline', 'warning',
    // Av
    'airplay', 'av_timer', 
    'fast_forward', 'fast_rewind', 'featured_play_list', 'featured_video', 'fiber_manual_record', 'fiber_new', 'fiber_pin', 'fiber_smart_record', 'games', 
    'library_add', 'library_books', 'mic', 'mic_none', 'mic_off', 'new_releases', 'not_interested', 'note', 'pause', 'pause_circle_filled', 
    'pause_circle_outline', 'play_arrow', 'play_circle_filled', 'play_circle_outline', 'playlist_add', 'playlist_add_check', 'playlist_play', 'queue', 'queue_play_next', 'radio', 
    'recent_actors', 'remove_from_queue', 'repeat', 'repeat_one', 'shuffle', 'skip_next', 'skip_previous', 'slow_motion_video', 'snooze', 'sort_by_alpha', 
    'stop', 'subscriptions', 'subtitles', 'surround_sound', 'video_label', 'volume_down', 'volume_mute', 'volume_off', 'volume_up', 'web', 'web_asset', 
    // Communication
    'business', 'call', 'call_end', 'call_made', 'call_merge', 'call_missed', 'call_missed_outgoing', 'call_received', 
    'call_split', 'cancel_presentation', 'chat ', 'chat_bubble', 'chat_bubble_outline', 'clear_all', 'comment', 'contact_mail', 'contact_phone', 'contacts', 
    'dialer_sip', 'dialpad', 'email', 'forum', 'import_contacts', 'import_export', 'invert_colors_off', 'list_alt', 
    'live_help', 'location_off', 'location_on', 'mail_outline', 'message', 'no_sim', 'pause_presentation', 'person_add_disabled', 'phonelink_erase', 'phonelink_lock', 
    'phonelink_ring', 'phonelink_setup', 'portable_wifi_off', 'present_to_all', 'print_disabled', 'ring_volume', 'rss_feed', 'screen_share', 'sentiment_satisfied_alt', 'speaker_phone', 'stay_current_landscape', 
    'stay_current_portrait', 'stop_screen_share', 'swap_calls', 'textsms', 'voicemail', 'vpn_key', 
    // Content
    'add', 'add_box', 'add_circle', 'add_circle_outline', 
    'archive', 'backspace', 'block', 'clear', 'create', 'delete_sweep', 'drafts', 'filter_list', 'flag', 
    'font_download', 'forward', 'gesture', 'inbox', 'link', 'link_off', 'low_priority', 'move_to_inbox', 'next_week', 
    'redo', 'remove', 'remove_circle', 'remove_circle_outline', 'reply', 'reply_all', 'report', 'report_off', 'save', 'save_alt', 
    'select_all', 'send', 'sort', 'text_format', 'unarchive', 'undo', 'weekend', 
    // Device
    'access_alarm', 'access_time', 'add_alarm', 'add_to_home_screen', 'airplanemode_active', 'airplanemode_inactive', 'battery_alert', 'battery_full', 'battery_unknown',
    'bluetooth', 'bluetooth_connected', 'bluetooth_disabled', 'bluetooth_searching', 'brightness_auto', 'brightness_high', 'brightness_low', 'brightness_medium', 'data_usage', 
    'developer_mode', 'devices', 'dvr', 'gps_fixed', 'gps_not_fixed', 'gps_off', 'graphic_eq', 'network_cell', 'network_wifi', 'nfc', 
    'screen_rotation', 'screen_lock_rotation', 'sd_storage', 'settings_system_daydream', 'signal_cellular_no_sim', 
    'signal_cellular_null', 'signal_cellular_off', 'signal_wifi_4_bar_lock', 'signal_wifi_off', 'storage', 'usb', 'wallpaper', 'widgets', 'wifi_tethering', 
    // Editor
    'attach_file', 'attach_money', 'border_all', 'border_bottom', 'border_clear', 'border_color', 'border_horizontal', 'border_inner', 'border_left', 'border_outer', 
    'border_right', 'border_style', 'border_top', 'border_vertical', 'bubble_chart', 'drag_handle', 'format_align_center', 'format_align_justify', 'format_align_left', 'format_align_right', 
    'format_bold', 'format_clear', 'format_color_fill', 'format_color_reset', 'format_color_text', 'format_indent_decrease', 'format_indent_increase', 'format_italic', 'format_line_spacing', 
    'format_list_bulleted', 'format_list_numbered', 'format_list_numbered_rtl', 'format_paint', 'format_quote', 'format_shapes', 'format_size', 'format_strikethrough', 'format_underlined', 
    'functions', 'highlight', 'insert_chart', 'insert_chart_outlined', 'insert_comment', 'insert_drive_file', 'insert_emoticon', 'insert_photo', 'linear_scale', 'merge_type', 'mode_comment', 
    'monetization_on', 'money_off', 'multiline_chart', 'notes', 'pie_chart', 'publish', 'short_text', 'show_chart', 'space_bar', 'strikethrough_s', 'table_chart', 
    'title', 'vertical_align_bottom', 'vertical_align_center', 'vertical_align_top', 'wrap_text', 
    // File
    'attachment', 'cloud', 'cloud_circle', 'cloud_done', 'cloud_download', 'cloud_off', 'cloud_queue', 'cloud_upload', 'create_new_folder', 'folder', 'folder_open', 'folder_shared', 
    // Hardware
    'cast', 'cast_connected', 'cast_for_education', 'computer', 'desktop_mac', 'desktop_windows', 'developer_board', 'device_hub', 'devices_other', 'dock', 'gamepad', 
    'headset', 'headset_mic', 'keyboard', 'keyboard_arrow_down', 'keyboard_arrow_left', 'keyboard_arrow_right', 'keyboard_arrow_up', 'keyboard_backspace', 'keyboard_capslock', 'keyboard_hide', 
    'keyboard_return', 'keyboard_tab', 'keyboard_voice', 'laptop', 'laptop_chromebook', 'laptop_windows', 'memory', 'mouse', 'power_input', 'router', 'scanner', 'security', 'sim_card', 
    'speaker', 'speaker_group', 'tablet_android', 'toys', 'tv', 'videogame_asset', 'watch', 
    // Image
    'add_a_photo', 'add_to_photos', 'adjust', 'assistant', 'audiotrack', 'blur_circular', 'blur_linear', 'blur_on', 'brightness_1', 'brightness_2', 'brightness_3', 
    'brightness_5', 'brightness_6', 'brightness_7', 'broken_image', 'brush', 'burst_mode', 'camera', 'camera_alt', 'camera_front', 'camera_rear', 'center_focus_strong', 'center_focus_weak', 
    'collections', 'collections_bookmark', 'color_lens', 'colorize', 'compare', 'control_point_duplicate', 'crop', 'crop_7_5', 'crop_16_9', 'crop_5_4', 'crop_3_2', 'crop_din', 'crop_free', 
    'crop_original', 'crop_rotate', 'dehaze', 'details', 'edit', 'exposure', 'exposure_neg_1', 'exposure_neg_2', 'exposure_plus_1', 'exposure_plus_2', 'exposure_zero', 'filter', 
    'filter_1', 'filter_2', 'filter_3', 'filter_4', 'filter_5', 'filter_6', 'filter_7', 'filter_8', 'filter_9', 'filter_b_and_w', 'filter_drama', 'filter_frames', 'filter_hdr', 'filter_none', 
    'filter_tilt_shift', 'filter_vintage', 'flare', 'flash_auto', 'flash_off', 'flash_on', 'flip', 'gradient', 'grain', 'grid_off', 'grid_on', 'hdr_strong', 'hdr_weak', 'healing', 
    'image_aspect_ratio', 'iso', 'leak_add', 'leak_remove', 'looks', 'looks_one', 'looks_two', 'looks_3', 'looks_4', 'looks_5', 'looks_6', 'loupe', 'movie_creation', 
    'movie_filter', 'music_note', 'nature', 'nature_people', 'panorama_fish_eye', 'panorama_horizontal', 'panorama_vertical', 'panorama_wide_angle', 'photo_filter', 
    'photo_size_select_small', 'picture_as_pdf', 'portrait', 'remove_red_eye', 'rotate_left', 'rotate_right', 'slideshow', 'straighten', 'style', 'switch_camera', 'texture', 
    'timelapse', 'timer', 'timer_off', 'tonality', 'transform', 'tune', 'view_comfy', 'view_compact', 'vignette', 'wb_incandescent', 'wb_iridescent', 'wb_sunny', 
    // Maps
    'beenhere', 'directions', 'directions_bike', 'directions_boat', 'directions_bus', 'directions_car', 'directions_railway', 'directions_run', 
    'directions_subway', 'directions_walk', 'edit_attributes', 'ev_station', 'flight', 'hotel', 'layers', 'layers_clear', 'local_activity', 'local_atm', 'local_bar', 'local_cafe', 
    'local_car_wash', 'local_dining', 'local_drink', 'local_florist', 'local_gas_station', 'local_hospital', 'local_laundry_service', 'local_library', 'local_mall', 'local_parking', 
    'local_pharmacy', 'local_pizza', 'local_printshop', 'local_shipping', 'local_taxi', 'map', 'navigation', 'near_me', 'person_pin', 'person_pin_circle', 'pin_drop', 'rate_review', 
    'restaurant', 'restaurant_menu', 'satellite', 'store_mall_directory', 'streetview', 'subway', 'traffic', 'train', 'tram', 'transfer_within_a_station', 'zoom_out_map', 
    // Navigation
    'apps', 'arrow_back', 'arrow_downward', 'arrow_drop_down', 'arrow_drop_down_circle', 'arrow_drop_up', 'arrow_forward', 
    'arrow_upward', 'cancel', 'check', 'chevron_left', 'chevron_right', 'close', 'expand_less', 'expand_more', 'first_page', 'fullscreen', 'fullscreen_exit', 'last_page', 'menu', 'more_horiz', 
    'more_vert', 'refresh', 'subdirectory_arrow_left', 'subdirectory_arrow_right', 'unfold_less', 'unfold_more', 
    // Notification
    'adb', 'airline_seat_flat', 'airline_seat_flat_angled', 'airline_seat_recline_extra', 'airline_seat_recline_normal', 'disc_full', 'more', 'network_check', 'network_locked', 'no_encryption', 
    'power', 'power_off', 'priority_high', 'sd_card', 'sms', 'sms_failed', 'sync', 'sync_disabled', 'sync_problem', 'system_update', 'vibration', 'vpn_lock', 'wc', 'wifi', 'wifi_off', 
    // Places
    'ac_unit', 'airport_shuttle', 'all_inclusive', 'beach_access', 'business_center', 'casino', 'child_care', 'child_friendly', 'fitness_center', 'golf_course', 'hot_tub', 'kitchen', 
    'pool', 'room_service', 'rv_hookup', 'smoke_free', 'smoking_rooms', 'spa', 
    // Social
    'cake', 'domain', 'group', 'group_add', 'location_city', 'mood', 'mood_bad', 'notifications', 'notifications_active', 'notifications_none', 'notifications_off', 'notifications_paused', 
    'pages', 'party_mode', 'people_outline', 'person', 'person_add', 'person_outline', 'public', 'school', 'sentiment_dissatisfied', 'sentiment_satisfied', 'sentiment_very_dissatisfied', 
    'sentiment_very_satisfied', 'share', 'thumb_down_alt', 'thumb_up_alt', 'whatshot', 
    // Toggle
    'check_box', 'check_box_outline_blank', 'indeterminate_check_box', 'radio_button_checked', 'radio_button_unchecked', 'star', 'star_border', 'star_half'];

    static fonts = ['Sans-serif', 'Roboto-Thin', 'Roboto-Light', 'Roboto-Regular', 'Roboto-Medium', 'Roboto-Bold']; 
}