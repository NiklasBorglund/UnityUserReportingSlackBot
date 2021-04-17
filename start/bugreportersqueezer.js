
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
    const [version] = await client.accessSecretVersion({
        name: `projects/${projectId}/secrets/${name}/versions/1`,
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
        botToken: await accessSecretVersion('bot-token'),
    });

    adapter.use(new SlackEventMiddleware())

    const controller = new Botkit({
        webhook_uri: '/api/messages',
        adapter: adapter
    })

    controller.ready(() => 
    {
        controller.on('message', async(bot, event) => {
            //console.log(event);

            if(event.attachments !== undefined && event.attachments.length > 0)
            {
                console.log("Found attachments!");
                var attachment = event.attachments[0];
                if(attachment.author_name === 'Unity User Reporting')
                {
                    console.log("Found attachment from bug report! Replying...");
                    await bot.reply(event, { channel: "bugreports", text: '<' + attachment.title_link + '|' + attachment.title + '>', unfurl_links: false });
                }
            }
        });
    })
}

squeezerInit()