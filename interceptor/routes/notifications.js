const notificationsRoute = {
        path: "/1.1/activity/about_me.json",
        method: "GET",
        beforeRequest: (xhr) => {
            const params = new URLSearchParams(xhr.modUrl);
            const since_id = params.get("since_id");
            const max_id = params.get("max_id");
            const user_id = xhr.modReqHeaders["x-act-as-user-id"] ?? params.get("user_id") ?? getCurrentUserId();
            let cursor;
            if(since_id && cursors[`notifications-${user_id}-top`]) {
                cursor = cursors[`notifications-${user_id}-top`];
            } else if(max_id && cursors[`notifications-${user_id}-bottom`]) {
                cursor = cursors[`notifications-${user_id}-bottom`];
            }

            xhr.modUrl = `https://${location.hostname}/i/api/2/notifications/all.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_has_nft_avatar=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&include_entities=true&include_user_entities=true&include_ext_media_color=true&include_ext_media_availability=true&include_ext_sensitive_media_warning=true&include_ext_trusted_friends_metadata=true&send_error_codes=true&simple_quoted_tweet=true&count=20&requestContext=launch&ext=mediaStats%2ChighlightedLabel%2ChasNftAvatar%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl${cursor ? `&cursor=${cursor}` : ''}`;
        },
        beforeSendHeaders: (xhr) => {
            xhr.storage.user_id = xhr.modReqHeaders["x-act-as-user-id"] ?? getCurrentUserId();
            xhr.modReqHeaders["Content-Type"] = "application/json";
            xhr.modReqHeaders["X-Twitter-Active-User"] = "yes";
            xhr.modReqHeaders["X-Twitter-Client-Language"] = navigator.language.split("-")[0];
            xhr.modReqHeaders["Authorization"] =
                PUBLIC_TOKENS[0];
            delete xhr.modReqHeaders["X-Twitter-Client-Version"];
        },
        afterRequest: (xhr) => {
            if(xhr.storage.notifications) {
                return xhr.storage.notifications;
            }
            try {
                const response = JSON.parse(xhr.responseText);
                const entries = response.timeline.instructions.find((i) => i.addEntries).addEntries.entries;
                const go = response.globalObjects;
                const notifications = [];
                for(let entry of entries) {
                    try {
                        if(entry.entryId.startsWith("notification-")) {
                            const sortIndex = entry.sortIndex;
                            const item = entry.content.item;
                            const type = item.clientEventInfo.element;
                            const notif = item.content.notification;
    
                            switch(type) {
                                case "users_retweeted_your_retweet":
                                case "users_retweeted_your_tweet":
                                case "user_liked_multiple_tweets": 
                                case "users_liked_your_retweet":
                                case "users_liked_your_tweet": {
                                    const nf = go.notifications[notif.id];
                                    const actions = nf.template.aggregateUserActionsV1;
                                    const users = actions.fromUsers.map(u => u.user.id);
                                    const tweets = actions.targetObjects.map(t => t.tweet.id);
                                    let i = 0;
                                    for(const userId of users) {
                                        for(const tweetId of tweets) {
                                            const tweet = go.tweets[tweetId];
                                            const user = go.users[userId];
                                            const action = type === "users_retweeted_your_tweet" || type === "users_retweeted_your_retweet" ? "retweet" : "favorite";
                                            if(!tweet || !user) continue;
                                            const id = `${tweetId}-${userId}-${action}`;
                                            if(seenNotifications.includes(id)) continue;
                                            seenNotifications.push(id);
                                            const notifSortIndex = +sortIndex - (i++);
                                            tweet.user = go.users[tweet.user_id_str];
                                            if(tweet.quoted_status_id_str) {
                                                tweet.quoted_status = go.tweets[tweet.quoted_status_id_str];
                                                tweet.quoted_status.user = go.users[tweet.quoted_status.user_id_str];
                                            }
    
                                            const sources = [user];
                                            const targets = [tweet];
                                            const target_objects = [tweet];
                                            notifications.push({
                                                action,
                                                created_at: formatTwitterStyle(new Date(notifSortIndex)),
                                                max_position: notifSortIndex+"",
                                                min_position: notifSortIndex+"",
                                                sources,
                                                sources_size: sources.length,
                                                target_objects,
                                                target_objects_size: target_objects.length,
                                                targets,
                                                targets_size: targets.length,
                                            })
                                        }
                                    }
                                    break;
                                }
                                case "user_mentioned_you":
                                case "user_replied_to_your_tweet": 
                                case "user_quoted_your_tweet":{
                                    const tweetId = item.content.tweet.id;
                                    const tweet = go.tweets[tweetId];
                                    if(!tweet) continue;
                                    tweet.user = go.users[tweet.user_id_str];
                                    const type = item.clientEventInfo.element === "user_mentioned_you" ? "mention" : item.clientEventInfo.element === "user_replied_to_your_tweet" ? "reply" : "quote";
                                    
                                    const id = `${tweetId}-${tweet.user_id_str}-${type}`;
                                    if(seenNotifications.includes(id)) continue;
                                    seenNotifications.push(id);
    
                                    if(tweet.quoted_status_id_str) {
                                        tweet.quoted_status = go.tweets[tweet.quoted_status_id_str];
                                        tweet.quoted_status.user = go.users[tweet.quoted_status.user_id_str];
                                    }
                                    
                                    notifications.push({
                                        action: type,
                                        created_at: formatTwitterStyle(new Date(+sortIndex)),
                                        max_position: sortIndex+"",
                                        min_position: sortIndex+"",
                                        sources: [tweet.user],
                                        sources_size: 1,
                                        target_objects: [tweet],
                                        target_objects_size: 1,
                                        targets: [tweet],
                                        targets_size: 1,
                                    });
                                    break;
                                }
                                case "follow_from_recommended_user":
                                case "users_followed_you": {
                                    const nf = go.notifications[notif.id];
                                    const users = nf.template.aggregateUserActionsV1.fromUsers.map(u => u.user.id);
                                    for(const userId of users) {
                                        const user = go.users[userId];
                                        if(!user) continue;
                                        const id = `${userId}-follow`;
                                        if(seenNotifications.includes(id)) continue;
                                        seenNotifications.push(id);
                                        notifications.push({
                                            action: "follow",
                                            created_at: formatTwitterStyle(new Date(+sortIndex)),
                                            max_position: sortIndex+"",
                                            min_position: sortIndex+"",
                                            sources: [user],
                                            sources_size: 1,
                                            target_objects: [user],
                                            target_objects_size: 1,
                                            targets: [user],
                                            targets_size: 1
                                        });
                                    }
                                    break;
                                }
                                case "generic_login_notification":
                                case "generic_acid_notification":
                                case "generic_safety_label_added":
                                    break;
                                default:
                                    console.warn(`Unknown notification type: ${type}`);
                            }
                        }
                    } catch (e) {
                        console.error(`Error parsing notification`, JSON.stringify(entry));
                    }
                }
                xhr.storage.notifications = notifications;
                const cursorTop = entries.find(
                    (e) =>
                        e.entryId.startsWith("sq-cursor-top-") ||
                        e.entryId.startsWith("cursor-top-")
                )?.content?.operation?.cursor?.value;
                if(cursorTop) {
                    cursors[`notifications-${xhr.storage.user_id}-top`] = cursorTop;
                }
                const cursorBottom = entries.find(
                    (e) =>
                        e.entryId.startsWith("sq-cursor-bottom-") ||
                        e.entryId.startsWith("cursor-bottom-")
                )?.content?.operation?.cursor?.value;
                if(cursorBottom) {
                    cursors[`notifications-${xhr.storage.user_id}-bottom`] = cursorBottom;
                }
                return notifications;
            } catch (e) {
                console.error(`Error parsing notifications`, e);
                return [];
            }
        },
    };

const mentionsRoute = {
        path: "/1.1/statuses/mentions_timeline.json",
        method: "GET",
        beforeRequest: (xhr) => {
            const params = new URLSearchParams(xhr.modUrl);
            const since_id = params.get("since_id");
            const max_id = params.get("max_id");
            const user_id = xhr.modReqHeaders["x-act-as-user-id"] ?? params.get("user_id") ?? getCurrentUserId();
            xhr.storage.user_id = user_id;
            let cursor;
            if(since_id && cursors[`mentions-${user_id}-top`]) {
                cursor = cursors[`mentions-${user_id}-top`];
            } else if(max_id && cursors[`mentions-${user_id}-bottom`]) {
                cursor = cursors[`mentions-${user_id}-bottom`];
            }

            xhr.modUrl = `https://${location.hostname}/i/api/2/notifications/mentions.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_has_nft_avatar=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&include_entities=true&include_user_entities=true&include_ext_media_color=true&include_ext_media_availability=true&include_ext_sensitive_media_warning=true&include_ext_trusted_friends_metadata=true&send_error_codes=true&simple_quoted_tweet=true&count=20&requestContext=launch&ext=mediaStats%2ChighlightedLabel%2ChasNftAvatar%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl${cursor ? `&cursor=${cursor}` : ''}`;
        },
        beforeSendHeaders: (xhr) => {
            xhr.modReqHeaders["Content-Type"] = "application/json";
            xhr.modReqHeaders["X-Twitter-Active-User"] = "yes";
            xhr.modReqHeaders["X-Twitter-Client-Language"] = "en";
            xhr.modReqHeaders["Authorization"] = PUBLIC_TOKENS[0];
            delete xhr.modReqHeaders["X-Twitter-Client-Version"];
        },
        afterRequest: (xhr) => {
            try {
                const response = JSON.parse(xhr.responseText);
                const entries = response.timeline.instructions.find((i) => i.addEntries).addEntries.entries;
                const go = response.globalObjects;
                const tweets = [];
                for(let entry of entries) {
                    if(entry.entryId.startsWith("notification-")) {
                        const sortIndex = entry.sortIndex;
                        const item = entry.content.item;
                        const type = item.clientEventInfo.element;

                        switch(type) {
                            case "user_mentioned_you":
                            case "user_replied_to_your_tweet": 
                            case "user_quoted_your_tweet":{
                                const tweetId = item.content.tweet.id;
                                const tweet = go.tweets[tweetId];
                                if(!tweet) continue;
                                tweet.user = go.users[tweet.user_id_str];

                                if(tweet.quoted_status_id_str) {
                                    tweet.quoted_status = go.tweets[tweet.quoted_status_id_str];
                                    tweet.quoted_status.user = go.users[tweet.quoted_status.user_id_str];
                                }
                                
                                tweets.push(tweet);
                                break;
                            }
                        }
                    }
                }
                const cursorTop = entries.find(
                    (e) =>
                        e.entryId.startsWith("sq-cursor-top-") ||
                        e.entryId.startsWith("cursor-top-")
                )?.content?.operation?.cursor?.value;
                if(cursorTop) {
                    cursors[`mentions-${xhr.storage.user_id}-top`] = cursorTop;
                }
                const cursorBottom = entries.find(
                    (e) =>
                        e.entryId.startsWith("sq-cursor-bottom-") ||
                        e.entryId.startsWith("cursor-bottom-")
                )?.content?.operation?.cursor?.value;
                if(cursorBottom) {
                    cursors[`mentions-${xhr.storage.user_id}-bottom`] = cursorBottom;
                }
                
                return tweets;
            } catch (e) {
                console.error(`Error parsing mentions`, e);
                return [];
            }
        }
    };
