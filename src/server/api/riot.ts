import { RiotAPI, RiotAPITypes } from '@fightmegg/riot-api'
import { env } from '~/env.mjs';


const config: RiotAPITypes.Config = {
    debug: false,
    cache: {
        cacheType: 'local', // local or ioredis
        client: null, // leave null if client is local
        ttls: {
            byMethod: {
                [RiotAPITypes.METHOD_KEY.SUMMONER.GET_BY_SUMMONER_NAME]: 5000, // ms
                [RiotAPITypes.METHOD_KEY.MATCH_V5.GET_IDS_BY_PUUID]: 5000,
                [RiotAPITypes.METHOD_KEY.MATCH_V5.GET_MATCH_BY_ID]: 5000,
            }
        }
    }
}


export const RiotClient = new RiotAPI(env.RIOT_API_KEY, config);