
const { Botkit } = require('botkit')
const { SlackAdapter, SlackEventMiddleware } = require(
    'botbuilder-adapter-slack')
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager')


/**
 * Returns the secret string from Google Cloud Secret Manager
 * @param {string} name The name of the secret.
 * @return {payload} The string value of the secret.
 */
async function accessSecretVersion(name) {
    const client = new SecretManagerServiceClient();
    const projectId = process.env.PROJECT_ID;
    console.info("Getting " + name + " from " + projectId);
    const [version] = await client.accessSecretVersion({
        name: 'projects/' + projectId + '/secrets/' + name + '/versions/1'
    });
    // Extract the payload as a string.
    const payload = version.payload.data.toString('utf8');
    return payload;
}

/**
 * Asynchronous function to initialize squeezer
 */
async function squeezerInit () {
    const adapter = new SlackAdapter({
        clientSigningSecret: await accessSecretVersion('client-signing-secret'),
        botToken: await accessSecretVersion('bot-token')
    });

    adapter.use(new SlackEventMiddleware())

    const controller = new Botkit({
        webhook_uri: '/api/messages',
        adapter: adapter
    })

    controller.ready(() =>
    {
        controller.on('bot_message', async(bot, event) => {
            bot.httpStatus(200)
            return new Promise(async(resolve, reject) => {
                resolve('resolved!');
                if (event.attachments !== undefined && event.attachments.length > 0) {
                    var attachment = event.attachments[0];
                    if (attachment.author_name === 'Unity User Reporting') {
                        var channel = 'bugreports';
                        var fixedTitle = attachment.title;

                        if (fixedTitle.includes('[MASTER]')) {
                            fixedTitle = fixedTitle.replace('[MASTER]', '');
                            channel = 'bugreports-master';
                        }
                        
                        await bot.changeContext(event.reference);

                        /* TITLE BUILD UP
                         * 1: report strength emoji
                         * 2: report strength string
                         * 3: severity emoji
                         * 4. severity text
                         * 5. is sure (bool)
                         * 6. is cheating (bool)
                         * 7. title text
                         */
                        const splitTitleWords = fixedTitle.split(',');
                        if(splitTitleWords.length === 7)
                        {
                            var reportStrengthEmoji = splitTitleWords[0];
                            var reportStrengthString = splitTitleWords[1];
                            var severityEmoji = splitTitleWords[2];
                            var severityText = splitTitleWords[3];
                            var isSure = splitTitleWords[4];
                            var isCheating = splitTitleWords[5];
                            var titleText = splitTitleWords[6];

                            var strengthString = "Strength " + reportStrengthEmoji + " : " + reportStrengthString;
                            var severityString = "Severity"
                            if(isSure === 'not sure')
                            {
                                severityString += " (reporter is not sure)";
                            }
                            severityString += ": " + severityText + " " + severityEmoji;
                            
                            var didCheatString = "";
                            
                            if(isCheating === "yes")
                            {
                                didCheatString = ". (player has cheats enabled)"
                            }
                            
                            var fullSlackMessage = '<' + attachment.title_link + '|' + titleText + '>';
                            await bot.reply(event,
                                {
                                    channel: channel,
                                    text: fullSlackMessage,
                                    unfurl_links: false,
                                    attachments: [
                                        {
                                            text: strengthString + ". " + severityString + didCheatString
                                        }
                                    ]
                                });
                        }
                        else
                        {
                            var fullSlackMessage = '<' + attachment.title_link + '|' + fixedTitle + '>';
                            await bot.reply(event,
                                {
                                    channel: channel,
                                    text: fullSlackMessage,
                                    unfurl_links: false
                                });
                        }
                    }
                }
            });
        });
    })
}

squeezerInit()