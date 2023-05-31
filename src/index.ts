import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { Method, Send, register } from '@reflet/express';
import morgan from 'morgan';
import { Logger } from '@app/logger';
import { countryCodes, get as getCountryFlagEmoji } from '@app/common/country-flag-emoji';
import { environment } from '@app/environment';
import outdent from 'outdent';

const logger = new Logger({ service: 'views' });

const app = express();

type View = {
    'remote-address'?: string;
    method?: string;
    url?: string;
    'http-version'?: string;
    'status-code'?: string;
    referrer?: string;
    'user-agent'?: string;
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

// Since were using a reverse proxy
// we need this to get the correct client IP
app.enable('trust proxy');

app.use(morgan((tokens, req, res): string => {
    return JSON.stringify({
        'remote-address': tokens['remote-addr'](req, res),
        'method': tokens['method'](req, res),
        'url': tokens['url'](req, res),
        'http-version': tokens['http-version'](req, res),
        'status-code': tokens['status'](req, res),
        'referrer': tokens['referrer'](req, res),
        'user-agent': tokens['user-agent'](req, res),
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
    @Method('all', '*')
    async route() {
        return outdent`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <meta http-equiv="X-UA-Compatible" content="IE=edge">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                    <meta name="apple-mobile-web-app-capable" content="yes">
                    <title>fish.lgbt</title>
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
                        <div class="content">fish.lgbt</div>
                    </div>
                </body>
            </html>        
        `;
    }
}

register(app, [Router]);

app.listen(environment.PORT);
