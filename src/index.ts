import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { Method, Send, register } from '@reflet/express';
import morgan from 'morgan';
import { Logger } from '@app/logger';
import { countryCodes, get as getCountryFlagEmoji } from '@app/common/country-flag-emoji';
import { environment } from '@app/environment';

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
            const message = JSON.parse(data) as View;
            const location = await getLocation(message['remote-address']!);
            console.log('view', {
                ...message,
                location,
            });
            logger.info('view', {
                ...message,
                location,
            });
        },
    },
}));

export class Router {
    @Send()
    @Method('all', '*')
    async route() {
        return 200;
    }
}

register(app, [Router]);

app.listen(environment.PORT);
