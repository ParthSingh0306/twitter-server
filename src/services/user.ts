import axios from "axios";
import { prismaClient } from "../clients/db";
import JWTService from "./jwt";
import { redisClient } from "../clients/redis";

interface GoogleTokenResult {
    iss?: string;
    nbf?: string;
    aud?: string;
    sub?: string;
    azp?: string;
    email: string;
    email_verified: string;
    picture?: string;
    name?: string;
    given_name: string;
    family_name?: string;
    iat?: string;
    exp?: string;
    jti?: string;
    alg?: string;
    kid?: string;
    typ?: string;
}

class UserService {
    public static async verifyGoogleAuthToken(token: string) {
        const googleToken = token;
        const googleOauthURL = new URL("https://oauth2.googleapis.com/tokeninfo");
        googleOauthURL.searchParams.set("id_token", googleToken);

        const { data } = await axios.get<GoogleTokenResult>(
            googleOauthURL.toString(),
            {
                responseType: "json",
            }
        );

        const user = await prismaClient.user.findUnique({
            where: {
                email: data.email,
            },
        });

        if (!user) {
            await prismaClient.user.create({
                data: {
                    email: data.email,
                    firstName: data.given_name,
                    lastName: data.family_name,
                    profileImageURL: data.picture,
                },
            });
        }

        const userInDb = await prismaClient.user.findUnique({
            where: { email: data.email },
        });

        if (!userInDb) throw new Error("User with email not found!!");

        const userToken = JWTService.generateTokenUser(userInDb);

        return userToken;
    }

    public static async getUserById(id: string) {
        const cachedUser = await redisClient.get(`USER:${id}`);
        if (cachedUser) {
            return JSON.parse(cachedUser);
        }
        const userById = await prismaClient.user.findUnique({ where: { id } });
        await redisClient.set(`USER:${id}`, JSON.stringify(userById));
        return userById;
    }

    public static async followUser(from: string, to: string) {
        const follow = prismaClient.follows.create({
            data: {
                follower: { connect: { id: from } },
                following: { connect: { id: to } },
            }
        });

        await redisClient.del(`USER:${from}`);
        return follow;
    }

    public static async unfollowUser(from: string, to: string) {
        const unfollow = await prismaClient.follows.delete({
            where: {
                followerId_followingId: {
                    followerId: from,
                    followingId: to,
                }
            }
        });

        await redisClient.del(`USER:${from}`);
        return unfollow;
    }
}

export default UserService;