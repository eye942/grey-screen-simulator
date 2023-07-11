import type { RiotAPITypes } from "@fightmegg/riot-api";
import { PlatformId } from "@fightmegg/riot-rate-limiter";

import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { RiotClient } from "../riot";

export type DeathDTO = {
  totalTimeSpentDead: number,
  totalTimeCCDealt: number,
  timePlayed: number,
  longestTimeSpentLiving: number,
  matchId: string,
  deaths: number,
  damageTaken: number,
  damageDealt: number,
  date: number

};

const RegionToCluster = new Map<RiotAPITypes.LoLRegion, RiotAPITypes.Cluster>(
  [
    [PlatformId.NA1, PlatformId.AMERICAS],
    [PlatformId.BR1, PlatformId.AMERICAS],
    [PlatformId.LA1, PlatformId.AMERICAS],
    [PlatformId.LA2, PlatformId.AMERICAS],
    [PlatformId.KR, PlatformId.ASIA],
    [PlatformId.JP1, PlatformId.ASIA],
    [PlatformId.EUNE1, PlatformId.EUROPE],
    [PlatformId.EUW1, PlatformId.EUROPE],
    [PlatformId.RU, PlatformId.EUROPE],
  ]);

const getSummoner = async (summonerName: string, region: RiotAPITypes.LoLRegion) => {
  try {
    const summonerDTO = await RiotClient.summoner.getBySummonerName({ summonerName, region });
    return summonerDTO;
  } catch (e) {
    console.error(e);
  }

  return null;
}

const getDeathInfo = async (matchId: string, puuid: string, cluster: RiotAPITypes.Cluster) => {

  try {
    const matchDTO = await RiotClient.matchV5.getMatchById({ matchId, cluster });
    const playerDTO = matchDTO.info.participants.find(player => player.puuid === puuid);
    return {
      totalTimeSpentDead: playerDTO?.totalTimeSpentDead,
      totalTimeCCDealt: playerDTO?.totalTimeCCDealt,
      timePlayed: playerDTO?.timePlayed,
      longestTimeSpentLiving: playerDTO?.longestTimeSpentLiving,
      matchId,
      deaths: playerDTO?.deaths,
      damageTaken: playerDTO?.totalDamageTaken,
      damageDealt: playerDTO?.totalDamageDealtToChampions,
      date: matchDTO.info.gameCreation,
      gameType: matchDTO.info.gameType,
      gameMode: matchDTO.info.gameMode,
    } as DeathDTO;
  } catch (e) {
    console.error(e);
  } finally {
    console.timeLog("getDeathInfo", matchId);
  }
  return null;
}

const getMatchIds = async (playerId: string, region: RiotAPITypes.LoLRegion) => {
  const cluster = RegionToCluster.get(region);
  if (!cluster) {
    return [];
  }
  console.time("getMatches");
  try {
    const matchDTO = await RiotClient.matchV5.getIdsbyPuuid({ puuid: playerId, cluster });

    return matchDTO;
  } catch (e) {
    console.error(e);
  } finally {
    console.timeEnd("getMatches");
  }
  return [];
}

const getStats = async (playerId: string, region: RiotAPITypes.LoLRegion, matchIds: string[]) => {
  console.time("getDeathInfo");

  const cluster = RegionToCluster.get(region);
  if (cluster === undefined) {
    return null;
  }

  const deathPromises = matchIds.map((matchId) => getDeathInfo(matchId, playerId, cluster))

  const deaths = (await Promise.allSettled(deathPromises))
    .filter((result): result is PromiseFulfilledResult<DeathDTO | null> => result.status === "fulfilled")
    .map(result => result.value)
    .filter((result): result is DeathDTO => result !== null);
  console.log("getDeathInfo:rejected", matchIds.length - deaths.length)
  console.timeEnd("getDeathInfo");
  return deaths;
}

const RegionEnum: Record<string, RiotAPITypes.LoLRegion> = {
  [PlatformId.NA1]: PlatformId.NA1,
  [PlatformId.BR1]: PlatformId.BR1,
  [PlatformId.LA1]: PlatformId.LA1,
  [PlatformId.LA2]: PlatformId.LA2,
  [PlatformId.KR]: PlatformId.KR,
  [PlatformId.JP1]: PlatformId.JP1,
  [PlatformId.EUNE1]: PlatformId.EUNE1,
  [PlatformId.EUW1]: PlatformId.EUW1,
  [PlatformId.RU]: PlatformId.RU,
} as const;


export const matchRouter = createTRPCRouter({
  matches: publicProcedure
    .input(z.object({ playerId: z.string().min(1), region: z.nativeEnum(RegionEnum), matchIds: z.array(z.string()) }))
    .query(async ({ input }) => {
      console.time("stats");
      const stats = await getStats(input.playerId, input.region, input.matchIds);
      console.timeEnd("stats");
      return stats;
    }),
  matchIds: publicProcedure
    .input(z.object({ playerId: z.string().min(1), region: z.nativeEnum(RegionEnum) }))
    .query(async ({ input }) => {
      const matchIds = getMatchIds(input.playerId, input.region);
      return matchIds;
    }),
  summonerId: publicProcedure
    .input(z.object({ username: z.string().min(1), region: z.nativeEnum(RegionEnum) }))
    .query(async ({ input }) => {
      const summoner = await getSummoner(input.username, input.region)
      return summoner?.puuid ?? null;
    })
});


