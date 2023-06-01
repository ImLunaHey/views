import 'reflect-metadata';
import 'dotenv/config';
import express, { Request } from 'express';
import { Get, Method, Req, Send, register } from '@reflet/express';
import morgan from 'morgan';
import { Logger } from '@app/logger';
import { countryCodes, get as getCountryFlagEmoji } from '@app/common/country-flag-emoji';
import { environment } from '@app/environment';
import outdent from 'outdent';
import { fetch } from 'undici';
import parseUserAgent from 'ua-parser-js';
import helmet from 'helmet';
import requestID from 'express-request-id';
import { script } from '@app/frontend';
import bodyParser from 'body-parser';

const logger = new Logger({ service: 'views' });

const app = express();

type View = {
    id?: string;
    hostname?: string;
    'remote-address'?: string;
    method?: string;
    url?: string;
    'http-version'?: string;
    'status-code'?: string;
    referrer?: string;
    headers?: Record<string, unknown>;
    body?: any;
    'user-agent'?: ReturnType<typeof parseUserAgent>;
};

type IpInfo = {
    status: 'success';
    country: string;
    countryCode: typeof countryCodes[number];
    region: string;
    regionName: string;
    city: string;
    zip: string;
    lat: number;
    lon: number;
    timezone: string;
    isp: string;
    org: string;
    as: string;
    query: string;
};

type IpInfoFail = {
    status: 'fail';
    message: string;
    query: string;
};

const getLocation = async (ip: string) => {
    const response = await fetch(`http://ip-api.com/json/${ip}`).then(response => response.json() as Promise<IpInfo | IpInfoFail>);
    if (response.status === 'fail') {
        return {
            countryEmoji: '🏠',
        };
    }

    if (response.status === 'success') {
        const {status: _, query: __, ...result} = response;
        return {
            ...result,
            countryEmoji: getCountryFlagEmoji(result.countryCode)?.emoji,
        }
    }

    return {
        countryEmoji: '🕳️',
    }
};

// Make shit more secure
app.use(helmet());

// Allow logs to be tracked across the whole stack
app.use(requestID());

// Allow every single permission
app.use((_request, response, next) => {
    response.setHeader('Permissions-Policy', 'accelerometer=(self), ambient-light-sensor=(self), autoplay=(self), battery=(self), camera=(self), cross-origin-isolated=(self), display-capture=(self), document-domain=(self), encrypted-media=(self), execution-while-not-rendered=(self), execution-while-out-of-viewport=(self), fullscreen=(self), geolocation=(self), gyroscope=(self), keyboard-map=(self), magnetometer=(self), microphone=(self), midi=(self), navigation-override=(self), payment=(self), picture-in-picture=(self), publickey-credentials-get=(self), screen-wake-lock=(self), sync-xhr=(self), usb=(self), web-share=(self), xr-spatial-tracking=(self), clipboard-read=(self), clipboard-write=(self), gamepad=(self), speaker-selection=(self), conversion-measurement=(self), focus-without-user-activation=(self), hid=(self), idle-detection=(self), interest-cohort=(self), serial=(self), sync-script=(self), trust-token-redemption=(self), unload=(self), window-placement=(self), vertical-scroll=(self)');
    next();
});

// Since were using a reverse proxy
// we need this to get the correct client IP
app.enable('trust proxy');

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.use(morgan((tokens, request, response): string => {
    return JSON.stringify({
        id: request.headers['X-Request-Id'] as string,
        hostname: request.hostname,
        'remote-address': tokens['remote-addr'](request, response),
        method: tokens['method'](request, response),
        url: tokens['url'](request, response),
        'http-version': tokens['http-version'](request, response),
        'status-code': tokens['status'](request, response),
        referrer: tokens['referrer'](request, response),
        headers: request.headers,
        body: request.body ?? null,
        'user-agent': parseUserAgent(tokens['user-agent'](request, response)),
    } satisfies View);
}, {
    stream: {
        write: async (data: string) => {
            try {
                const message = JSON.parse(data) as View;
                const location = await getLocation(message['remote-address']!);
                logger.info('view', {
                    ...message,
                    location,
                });
            } catch (error: unknown) {
                logger.error('failed logging', {
                    error,
                    data,
                });
            }
        },
    },
}));

export class Router {
    @Send()
    @Get('/robots.txt')
    robotsTxt() {
        return outdent`
            User-agent: *
            Allow: /
        `;
    }

    @Send()
    @Get('/')
    async route(@Req request: Request) {
        return outdent`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <meta http-equiv="X-UA-Compatible" content="IE=edge">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                    <meta name="apple-mobile-web-app-capable" content="yes">
                    <title>${request.hostname}</title>
                    <style>
                    * { 
                        box-sizing: padding-box;
                    }
                    html {
                        height: 100%;
                        background: black;
                        color: white;
                    }
                    body {
                        font-family: monospace;
                        font-size: 14px;
                        height: 100%;
                        margin: 0;
                        padding: 0;
                    }
                    .container {
                        height: 100%;
                        position: relative;
                    }
                    .content {
                        text-align: center;
                        position: relative;
                        top: 50%;
                        transform: translateY(-50%);
                    }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="content">${request.hostname}</div>
                    </div>
                </body>
                <script>${script}</script>
            </html>        
        `;
    }

    @Send()
    @Method('all', '*')
    async getForm(@Req request: Request) {
        return outdent`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <meta http-equiv="X-UA-Compatible" content="IE=edge">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                    <meta name="apple-mobile-web-app-capable" content="yes">
                    <title>${request.hostname}</title>
                    <style>
                    * { 
                        box-sizing: padding-box;
                        font-family: monospace;
                    }
                    html {
                        height: 100%;
                        background: black;
                        color: white;
                    }
                    body {
                        font-family: monospace;
                        font-size: 14px;
                        height: 100%;
                        margin: 0;
                        padding: 0;
                    }
                    form {
                        margin-top: 15px;
                    }
                    input, button {
                        padding: 5px;
                    }
                    .container {
                        height: 100%;
                        position: relative;
                    }
                    .content {
                        text-align: center;
                        position: relative;
                        top: 50%;
                        transform: translateY(-50%);
                    }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="content">
                            <div>${request.hostname}</div>
                            <form action="/admin" method="POST">
                                <input type="text" placeholder="Username" name="username" required>
                                <input type="password" placeholder="Password" name="password" required>
                                <button type="submit">Sign-in</button>
                            </form>
                        </div>
                    </div>
                </body>
                <script>${script}</script>
            </html>        
        `;
    }
}

register(app, [Router]);

app.listen(environment.PORT);
