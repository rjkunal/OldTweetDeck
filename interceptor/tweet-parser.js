function parseNoteTweet(result) {
    let text, entities;
    if (result.note_tweet.note_tweet_results.result) {
        text = result.note_tweet.note_tweet_results.result.text;
        entities = result.note_tweet.note_tweet_results.result.entity_set;
        if (result.note_tweet.note_tweet_results.result.richtext?.richtext_tags.length) {
            entities.richtext = result.note_tweet.note_tweet_results.result.richtext.richtext_tags; // logically, richtext is an entity, right?
        }
    } else {
        text = result.note_tweet.note_tweet_results.text;
        entities = result.note_tweet.note_tweet_results.entity_set;
    }
    return { text, entities };
}

function parseTweet(res) {
    try {

        if (typeof res !== "object") return;
        if (res.limitedActionResults) {
            let limitation = res.limitedActionResults.limited_actions.find((l) => l.action === "Reply");
            if (limitation) {
                res.tweet.legacy.limited_actions_text = limitation.prompt
                    ? limitation.prompt.subtext.text
                    : "This tweet has limitations to who can reply.";
            }
            res = res.tweet;
        }
        if (!res.legacy && res.tweet) res = res.tweet;
        let tweet = res.legacy;
        if (!res.core || !tweet) return;
        if(!tweet.id) {
            tweet.id = +tweet.id_str;
        }
        let result = res.core.user_results.result;
        tweet.conversation_id = +tweet.conversation_id_str;
        tweet.text = tweet.full_text;
        tweet.user = result.legacy;
        tweet.user.id = +tweet.user_id_str;
        tweet.user.id_str = tweet.user_id_str;
        if (result.is_blue_verified) {
            tweet.user.verified = true;
            tweet.user.verified_type = "Blue";
        }
        if(!tweet.user.profile_image_url && result?.avatar?.image_url) {
            tweet.user.profile_image_url = result.avatar.image_url;
            tweet.user.profile_image_url_https = tweet.user.profile_image_url.replace("http://", "https://");
        }
        if(!tweet.user.profile_image_url && tweet.user.profile_image_url_https) {
            tweet.user.profile_image_url = tweet.user.profile_image_url_https.replace("https://", "http://");
        }
        if(!tweet.user.name && result?.core?.name) {
            tweet.user.name = result.core.name;
        }
        if(!tweet.user.screen_name && result?.core?.screen_name) {
            tweet.user.screen_name = result.core.screen_name;
        }
        if(!tweet.user.created_at && result?.core?.created_at) {
            tweet.user.created_at = result.core.created_at;
        }
        if(result?.relationship_perspectives?.muting) {
            tweet.user.muting = true;
        }
        if(result?.relationship_perspectives?.blocking) {
            tweet.user.blocking = true;
        }
        if(result?.privacy?.protected) {
            tweet.user.protected = true;
        }
        if(result?.location?.location) {
            tweet.user.location = res.core.user_results.result.location.location;
        }
        if(result?.verification?.verified) {
            tweet.user.verified = true;
        }

        if (tweet.retweeted_status_result?.result) {
            let result = tweet.retweeted_status_result.result;
            if (result.limitedActionResults) {
                let limitation = result.limitedActionResults.limited_actions.find(
                    (l) => l.action === "Reply"
                );
                if (limitation) {
                    result.tweet.legacy.limited_actions_text = limitation.prompt
                        ? limitation.prompt.subtext.text
                        : "This tweet has limitations to who can reply.";
                }
                result = result.tweet;
            }
            if (
                result.quoted_status_result &&
                result.quoted_status_result.result &&
                result.quoted_status_result.result.legacy &&
                result.quoted_status_result.result.core &&
                result.quoted_status_result.result.core.user_results.result.legacy
            ) {
                result.legacy.quoted_status = result.quoted_status_result.result.legacy;
                result.legacy.quoted_status.id = +result.legacy.quoted_status.id_str;
                result.legacy.quoted_status.text = result.legacy.quoted_status.full_text;
                result.legacy.quoted_status.conversation_id = +result.legacy.quoted_status.conversation_id_str;
                if (result.legacy.quoted_status) {
                    result.legacy.quoted_status.user =
                        result.quoted_status_result.result.core.user_results.result.legacy;
                    result.legacy.quoted_status.user.id_str = result.legacy.quoted_status.user_id_str;
                    result.legacy.quoted_status.user.id = +result.legacy.quoted_status.user_id_str;
                    let user_result = result?.quoted_status_result?.result?.core?.user_results?.result;
                    if(!result.legacy.quoted_status.user.profile_image_url && user_result?.avatar?.image_url) {
                        result.legacy.quoted_status.user.profile_image_url = user_result.avatar.image_url;
                        result.legacy.quoted_status.user.profile_image_url_https = result.legacy.quoted_status.user.profile_image_url.replace("http://", "https://");
                    }
                    if(!result.legacy.quoted_status.user.profile_image_url && result.legacy.quoted_status.user.profile_image_url_https) {
                        result.legacy.quoted_status.user.profile_image_url = result.legacy.quoted_status.user.profile_image_url_https.replace("https://", "http://");
                    }
                    if(!result.legacy.quoted_status.user.name && user_result?.core?.name) {
                        result.legacy.quoted_status.user.name = user_result.core.name;
                    }
                    if(!result.legacy.quoted_status.user.screen_name && user_result?.core?.screen_name) {
                        result.legacy.quoted_status.user.screen_name = user_result.core.screen_name;
                    }
                    if(!result.legacy.quoted_status.user.created_at && user_result?.core?.created_at) {
                        result.legacy.quoted_status.user.created_at = user_result.core.created_at;
                    }
                    if(user_result?.relationship_perspectives?.muting) {
                        result.legacy.quoted_status.user.muting = true;
                    }
                    if(user_result?.relationship_perspectives?.blocking) {
                        result.legacy.quoted_status.user.blocking = true;
                    }
                    if(user_result?.privacy?.protected) {
                        result.legacy.quoted_status.user.protected = true;
                    }
                    if(user_result?.location?.location) {
                        result.legacy.quoted_status.user.location = user_result.location.location;
                    }
                    if(user_result?.verification?.verified) {
                        result.legacy.quoted_status.user.verified = true;
                    }
                    
                    if (user_result.is_blue_verified) {
                        result.legacy.quoted_status.user.verified = true;
                        result.legacy.quoted_status.user.verified_type = "Blue";
                    }
                } else {
                    console.warn("No retweeted quoted status", result);
                }
            }
            tweet.retweeted_status = result.legacy;
            if (tweet.retweeted_status && result.core.user_results.result.legacy) {
                let user_result = result?.core?.user_results?.result;
                tweet.retweeted_status.text = tweet.retweeted_status.full_text;
                tweet.retweeted_status.id = +tweet.retweeted_status.id_str;
                tweet.retweeted_status.conversation_id = +tweet.retweeted_status.conversation_id_str;
                tweet.retweeted_status.user = user_result.legacy;
                tweet.retweeted_status.user.id_str = tweet.retweeted_status.user_id_str;
                tweet.retweeted_status.user.id = +tweet.retweeted_status.user_id_str;
                if(!tweet.retweeted_status.user.profile_image_url && user_result?.avatar?.image_url) {
                    tweet.retweeted_status.user.profile_image_url = user_result.avatar.image_url;
                    tweet.retweeted_status.user.profile_image_url_https = tweet.retweeted_status.user.profile_image_url.replace("http://", "https://");
                } 
                if(!tweet.retweeted_status.user.profile_image_url && tweet.retweeted_status.user.profile_image_url_https) {
                    tweet.retweeted_status.user.profile_image_url = tweet.retweeted_status.user.profile_image_url_https.replace("https://", "http://");
                }
                if(!tweet.retweeted_status.user.name && user_result?.core?.name) {
                    tweet.retweeted_status.user.name = user_result.core.name;
                }
                if(!tweet.retweeted_status.user.screen_name && user_result?.core?.screen_name) {
                    tweet.retweeted_status.user.screen_name = user_result.core.screen_name;
                }
                if(!tweet.retweeted_status.user.created_at && user_result?.core?.created_at) {
                    tweet.retweeted_status.user.created_at = user_result.core.created_at;
                }
                if(user_result?.relationship_perspectives?.muting) {
                    tweet.retweeted_status.user.muting = true;
                }
                if(user_result?.relationship_perspectives?.blocking) {
                    tweet.retweeted_status.user.blocking = true;
                }
                if(user_result?.privacy?.protected) {
                    tweet.retweeted_status.user.protected = true;
                }
                if(user_result?.location?.location) {
                    tweet.retweeted_status.user.location = result.core.user_results.result.location.location;
                }
                if(user_result?.verification?.verified) {
                    tweet.retweeted_status.user.verified = true;
                }

                if (result.core.user_results.result.is_blue_verified) {
                    tweet.retweeted_status.user.verified = true;
                    tweet.retweeted_status.user.verified_type = "Blue";
                }
                tweet.retweeted_status.ext = {};
                if (result.views) {
                    tweet.retweeted_status.ext.views = { r: { ok: { count: +result.views.count } } };
                }
                if (res.card && res.card.legacy && res.card.legacy.binding_values) {
                    tweet.retweeted_status.card = res.card.legacy;
                }
            } else {
                console.warn("No retweeted status", result);
            }
            if (result.note_tweet && result.note_tweet.note_tweet_results && localStorage.OTDenableAutoExpand === "1") {
                let note = parseNoteTweet(result);
                tweet.retweeted_status.full_text = note.text;
                tweet.retweeted_status.entities = note.entities;
                tweet.retweeted_status.display_text_range = undefined; // no text range for long tweets
            }
        }
    
        if (res.quoted_status_result) {
            tweet.quoted_status_result = res.quoted_status_result;
        }
        if (res.note_tweet && res.note_tweet.note_tweet_results) {
            let note = parseNoteTweet(res);
            tweet.full_text = note.text;
            tweet.entities = note.entities;
            tweet.display_text_range = undefined; // no text range for long tweets
        }
        if (tweet.quoted_status_result && tweet.quoted_status_result.result) {
            let result = tweet.quoted_status_result.result;
            if (!result.core && result.tweet) result = result.tweet;
            if (result.limitedActionResults) {
                let limitation = result.limitedActionResults.limited_actions.find(
                    (l) => l.action === "Reply"
                );
                if (limitation) {
                    result.tweet.legacy.limited_actions_text = limitation.prompt
                        ? limitation.prompt.subtext.text
                        : "This tweet has limitations to who can reply.";
                }
                result = result.tweet;
            }
            if(result && result.legacy) {
                tweet.quoted_status = result.legacy;
                tweet.quoted_status.id = +tweet.quoted_status.id_str;
                tweet.quoted_status.conversation_id = +tweet.quoted_status.conversation_id_str;
                tweet.quoted_status.text = tweet.quoted_status.full_text;
                if (tweet.quoted_status) {
                    tweet.quoted_status.user = result.core.user_results.result.legacy;
                    if (!tweet.quoted_status.user) {
                        delete tweet.quoted_status;
                    } else {
                        tweet.quoted_status.user.id_str = tweet.quoted_status.user_id_str;
                        tweet.quoted_status.user.id = +tweet.quoted_status.user_id_str;
                        let user_result = result?.core?.user_results?.result;
                        if(!tweet.quoted_status.user.profile_image_url && user_result?.avatar?.image_url) {
                            tweet.quoted_status.user.profile_image_url = user_result.avatar.image_url;
                            tweet.quoted_status.user.profile_image_url_https = tweet.quoted_status.user.profile_image_url.replace("http://", "https://");
                        }
                        if(!tweet.quoted_status.user.profile_image_url && tweet.quoted_status.user.profile_image_url_https) {
                            tweet.quoted_status.user.profile_image_url = tweet.quoted_status.user.profile_image_url_https.replace("https://", "http://");
                        }
                        if(!tweet.quoted_status.user.name && user_result?.core?.name) {
                            tweet.quoted_status.user.name = user_result.core.name;
                        }
                        if(!tweet.quoted_status.user.screen_name && user_result?.core?.screen_name) {
                            tweet.quoted_status.user.screen_name = user_result.core.screen_name;
                        }
                        if(!tweet.quoted_status.user.created_at && user_result?.core?.created_at) {
                            tweet.quoted_status.user.created_at = user_result.core.created_at;
                        }
                        if(user_result?.relationship_perspectives?.muting) {
                            tweet.quoted_status.user.muting = true;
                        }
                        if(user_result?.relationship_perspectives?.blocking) {
                            tweet.quoted_status.user.blocking = true;
                        }
                        if(user_result?.privacy?.protected) {
                            tweet.quoted_status.user.protected = true;
                        }
                        if(user_result?.location?.location) {
                            tweet.quoted_status.user.location = user_result.location.location;
                        }
                        if(user_result?.verification?.verified) {
                            tweet.quoted_status.user.verified = true;
                        }
                        if (user_result.is_blue_verified) {
                            tweet.quoted_status.user.verified = true;
                            tweet.quoted_status.user.verified_type = "Blue";
                        }
                        tweet.quoted_status.ext = {};
                        if (result.views) {
                            tweet.quoted_status.ext.views = { r: { ok: { count: +result.views.count } } };
                        }
                    }
                } else {
                    console.warn("No quoted status", result);
                }
            }
        }
        if (res.card && res.card.legacy) {
            tweet.card = res.card.legacy;
            let bvo = {};
            for (let i = 0; i < tweet.card.binding_values.length; i++) {
                let bv = tweet.card.binding_values[i];
                bvo[bv.key] = bv.value;
            }
            tweet.card.binding_values = bvo;
        }
        if (res.views) {
            if (!tweet.ext) tweet.ext = {};
            tweet.ext.views = { r: { ok: { count: +res.views.count } } };
        }
        if (res.source) {
            tweet.source = res.source;
        }
        if (res.birdwatch_pivot) {
            // community notes
            tweet.birdwatch = res.birdwatch_pivot;
        }
    
        if (tweet.favorited && tweet.favorite_count === 0) {
            tweet.favorite_count = 1;
        }
        if (tweet.retweeted && tweet.retweet_count === 0) {
            tweet.retweet_count = 1;
        }
    
        return tweet;
    } catch (e) {
        console.error('error parsing tweet', e, res);
        throw new Error('error parsing tweet');
    }
}

