import { EventEmitter } from 'events';
import { DEFAULT_SERVER, API, CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES } from '../utils/constants';
import { validateAccount, validateJoinOptions, validateRoomOptions } from '../utils/validation';
import { PacketBuilder } from './PacketBuilder';
import { PacketParser } from './PacketParser';
import io from 'socket.io-client';
import axios from 'axios';

type SocketInstance = ReturnType<typeof io>;

export type Account = {
    username: string;
    password?: string;
    guest: boolean;
};

export type RoomInfo = {
    address: string | null;
    name: string | null;
    server: string;
    bypass: string;
    id: number | null;
    dbid: number | null;
    teamsLocked: boolean;
    map: any; // Mapear o tipo de mapa
    inGame: boolean;
    // ... outras propriedades de sala
};

export type GameInfo = {
    id: number | null;
    host: number | null;
    banned: boolean;
};

export type Player = {
    id: number;
    username: string;
    guest: boolean;
    peerID: string;
    // ... outras propriedades de jogador
};

export type JoinOptions = {
    password?: string;
    peerID?: string;
};

export type CreateRoomOptions = {
    roomname?: string;
    maxplayers?: number;
    password?: string;
    // ... outras opções de criação
};

/**
 * Gerencia a conexão WebSocket com o servidor Bonk.io e o estado do jogo.
 */
export class BonkConnection extends EventEmitter {
    private socket: SocketInstance | null = null;
    private connected: boolean = false;
    private keepAliveTimer: NodeJS.Timeout | null = null;
    private PROTOCOL_VERSION: number = 7; // Versão do protocolo Bonk.io (pode precisar de atualização)

    public account: Account;
    public server: string;
    public room: RoomInfo;
    public game: GameInfo;
    public players: Map<number, Player> = new Map();
    public token: string | null = null;
    public peerID: string = this.generatePeerID();
    public avatar: any = { layers: [], bc: 0 }; // Avatar padrão
    public location: any = {}; // Informações de localização (lat, long, country)

    constructor(account: Account, server: string = DEFAULT_SERVER) {
        super();
        this.account = validateAccount(account);
        this.server = server;

        this.room = {
            address: null,
            name: null,
            server: this.server,
            bypass: '',
            id: null,
            dbid: null,
            teamsLocked: false,
            map: null,
            inGame: false,
        };

        this.game = {
            id: null,
            host: null,
            banned: false,
        };
    }

    /**
     * Gera um ID de par (peerID) aleatório.
     * @returns {string} O peerID gerado.
     */
    private generatePeerID(): string {
        // Implementação de geração de peerID (pode ser simplificada por enquanto)
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    /**
     * Obtém o token de autenticação do usuário.
     * (Implementação baseada no bonkbot original, usando axios)
     * @param {string} username - Nome de usuário.
     * @param {string} password - Senha.
     * @returns {Promise<string>} O token de autenticação.
     */
    private async getToken(username: string, password?: string): Promise<string> {
        // TODO: Implementar a lógica de obtenção de token
        // Por enquanto, retorna um token falso se não for convidado
        if (!password) {
            throw new Error('Password is required for non-guest accounts.');
        }
        // Lógica de requisição HTTP para login
        // const response = await axios.post(API.LOGIN, { username, password });
        // return response.data.token;
        return 'FAKE_TOKEN_12345';
    }

    /**
     * Obtém informações do servidor (localização, etc.).
     * (Implementação baseada no bonkbot original)
     * @returns {Promise<any>} Informações do servidor.
     */
    private async getServerInfo(): Promise<any> {
        // TODO: Implementar a lógica de obtenção de informações do servidor
        // Por enquanto, retorna um objeto mock
        return {
            server: DEFAULT_SERVER,
            lat: 0,
            long: 0,
            country: 'BR',
        };
    }

    /**
     * Inicializa a conexão (autenticação, obtenção de info do servidor).
     * @returns {Promise<BonkConnection>} Esta instância.
     */
    public async init(): Promise<BonkConnection> {
        // Lógica de inicialização (getToken, getServerInfo)
        if (!this.account.guest && !this.token) {
            this.token = await this.getToken(this.account.username, this.account.password);
        }

        if (!this.server || this.server === DEFAULT_SERVER) {
            const serverInfo = await this.getServerInfo();
            this.server = serverInfo.server;
            this.location = serverInfo;
            this.room.server = this.server;
        }

        this.emit('ready');
        return this;
    }

    /**
     * Inicia o temporizador de keep-alive.
     */
    private startKeepAlive(): void {
        this.keepAliveTimer = setInterval(() => {
            if (this.connected && this.socket && this.socket.connected) {
                this.sendTimesync();
            } else if (this.connected) {
                this.stopBot();
                this.emit('disconnect');
            }
        }, 5000);
    }

    /**
     * Para o bot (limpa timers, etc.).
     */
    private stopBot(): void {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
        this.connected = false;
    }

    /**
     * Configura os ouvintes de eventos do Socket.IO.
     */
    private setupSocketEvents(): void {
        if (!this.socket) return;

        // O Bonk.io usa o evento 'message' para a maioria dos pacotes
        this.socket.on('message', (data: any) => {
            const packet = PacketParser.parse(data);
            this.handlePacket(packet);
        });

        // Evento de desconexão
        this.socket.on('disconnect', (reason: string) => {
            this.stopBot();
            this.emit('disconnect', reason);
        });

        // Evento de erro
        this.socket.on('error', (error: Error) => {
            this.emit('error', error);
        });
    }

    /**
     * Conecta-se ao servidor Bonk.io.
     * @returns {Promise<BonkConnection>} Esta instância.
     */
    public async connect(): Promise<BonkConnection> {
        if (this.connected) {
            this.disconnect();
        }

        // Desabilitar verificação de certificado TLS (necessário para bonk.io)
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        const socketAddr = `https://${this.server}.bonk.io`;

        return new Promise((resolve, reject) => {
            try {
                const socketOptions = {
                    transports: ['websocket'],
                    reconnection: false,
                    timeout: 10000,
                    forceNew: true,
                    path: '/socket.io',
                    rejectUnauthorized: false // Necessário para bonk.io
                };

                this.socket = io(socketAddr, socketOptions);

                const timeout = setTimeout(() => {
                    if (!this.connected) {
                        reject(new Error(`Connection timeout to server: ${this.server}`));
                        this.stopBot();
                    }
                }, 10000);

                this.socket.on('connect', () => {
                    clearTimeout(timeout);
                    this.connected = true;
                    this.setupSocketEvents();
                    this.startKeepAlive();
                    this.emit('connect');
                    resolve(this);
                });

                this.socket.on('connect_error', (error: Error) => {
                    if (!this.connected) {
                        clearTimeout(timeout);
                        reject(new Error(`Failed to connect to server: ${error.message}`));
                    }
                    this.emit('error', error);
                });

                this.socket.on('disconnect', (reason: string) => {
                    if (!this.connected) {
                        clearTimeout(timeout);
                        reject(new Error(`Connection closed before fully established: ${reason}`));
                    }
                    this.stopBot();
                    this.emit('disconnect', reason);
                });

            } catch (error: any) {
                reject(new Error(`Failed to create Socket.IO connection: ${error.message}`));
            }
        });
    }

    /**
     * Desconecta do servidor.
     */
    public disconnect(): void {
        if (!this.connected) return;

        this.stopBot();

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * Envia uma mensagem (pacote) para o servidor.
     * @param {number} type - Tipo da mensagem (CLIENT_MESSAGE_TYPES).
     * @param {any} data - Dados da mensagem.
     */
    public sendMessage(type: number, data: any): void {
        if (!this.socket || !this.connected) {
            throw new Error('Not connected to server.');
        }

        const packet = PacketBuilder.build(type, data);
        this.socket.emit('message', packet);
    }

    /**
     * Envia o pacote TIMESYNC (keep-alive).
     */
    private sendTimesync(): void {
        this.sendMessage(CLIENT_MESSAGE_TYPES.TIMESYNC, { time: Date.now() });
    }

    /**
     * Envia uma mensagem de chat para a sala.
     * @param {string} message - A mensagem a ser enviada.
     */
    public sendChat(message: string): void {
        this.sendMessage(CLIENT_MESSAGE_TYPES.CHAT_MESSAGE, { message });
    }

    /**
     * Envia um comando de input do jogador (movimento).
     * @param {number} input - O valor do input (ex: 1 para esquerda, 2 para direita, etc.).
     * @param {number} frame - O frame atual do jogo.
     * @param {number} sequence - O número de sequência do input.
     */
    public sendInput(input: number, frame: number, sequence: number): void {
        this.sendMessage(CLIENT_MESSAGE_TYPES.SEND_INPUTS, {
            input,
            frame,
            sequence,
        });
    }

    /**
     * Envia o comando para iniciar o jogo.
     */
    public startGame(): void {
        this.sendMessage(CLIENT_MESSAGE_TYPES.TRIGGER_START, {});
    }

    /**
     * Envia o comando para mudar de time.
     * @param {number} team - O ID do time (1 a 5, ou 0 para espectador).
     */
    public changeTeam(team: number): void {
        this.sendMessage(CLIENT_MESSAGE_TYPES.CHANGE_OWN_TEAM, { team });
    }

    /**
     * Envia o comando para definir o status de pronto/não pronto.
     * @param {boolean} ready - True para pronto, False para não pronto.
     */
    public setReady(ready: boolean): void {
        this.sendMessage(CLIENT_MESSAGE_TYPES.SET_READY, { ready });
    }

    /**
     * Envia o comando para chutar/banir um jogador.
     * @param {number} id - O ID do jogador.
     * @param {boolean} ban - Se deve banir (true) ou apenas chutar (false).
     */
    public kickBanPlayer(id: number, ban: boolean = false): void {
        this.sendMessage(CLIENT_MESSAGE_TYPES.KICK_BAN_PLAYER, { id, ban });
    }

    // Outras funcionalidades podem ser adicionadas aqui, como:
    // - setMap(mapData: any)
    // - setGameMode(mode: string)
    // - setRounds(rounds: number)
    // - sendMapSuggest(mapID: number)
    // - etc.


    /**
     * Cria uma nova sala.
     * @param {CreateRoomOptions} options - Opções de criação de sala.
     * @returns {Promise<RoomInfo>} Informações da sala criada.
     */
    public async createRoom(options: CreateRoomOptions = {}): Promise<RoomInfo> {
        if (!this.connected) {
            throw new Error('Not connected to server.');
        }

        // A validação será implementada em src/utils/validation.ts
        // const validatedOptions = validateRoomOptions(options);
        const validatedOptions = options; // Temporário

        this.room.name = validatedOptions.roomname || `BonkBot Room ${Math.floor(Math.random() * 1000)}`;
        this.room.server = this.server; // Garante que o servidor está correto

        const createData = {
            peerID: this.peerID,
            roomName: this.room.name,
            maxPlayers: validatedOptions.maxplayers || 8,
            password: validatedOptions.password || '',
            dbid: 11822936, // Valor padrão do bonkbot
            guest: this.account.guest,
            minLevel: 0,
            maxLevel: 999,
            latitude: this.location.lat || 0,
            longitude: this.location.long || 0,
            country: this.location.country || 'BR',
            version: this.PROTOCOL_VERSION,
            hidden: (validatedOptions as any).hidden ? 1 : 0,
            quick: (validatedOptions as any).quick || false,
            mode: (validatedOptions as any).mode || 'custom',
            token: this.token || '',
            avatar: this.avatar,
        };

        if (this.account.guest) {
            (createData as any).guestName = this.account.username;
        }

        // O bonkbot original não espera uma resposta aqui, apenas envia a mensagem
        this.sendMessage(CLIENT_MESSAGE_TYPES.CREATE_ROOM, createData);

        // O endereço da sala (roomID e bypass) é recebido posteriormente via pacote 'ROOM_SHARE_LINK'
        // Por enquanto, retornamos o que sabemos
        return this.room;
    }

    /**
     * Entra em uma sala existente.
     * @param {string} roomAddress - Endereço da sala (ex: '123456' ou '123456abcde').
     * @param {JoinOptions} options - Opções de entrada.
     * @returns {Promise<void>}
     */
    public async joinRoom(roomAddress: string, options: JoinOptions = {}): Promise<void> {
        if (!this.connected) {
            throw new Error('Not connected to server.');
        }

        // A validação será implementada em src/utils/validation.ts
        // const validatedOptions = validateJoinOptions(options);
        const validatedOptions = options; // Temporário

        // 1. Obter endereço completo (server, bypass) se necessário
        const addressInfo = await this.getAddressFromUrl(`https://bonk.io/game.html?${roomAddress}`);
        if (!addressInfo || addressInfo.r !== 'success') {
            throw new Error('Failed to get room address information.');
        }

        this.setAddress(addressInfo);

        // 2. Enviar mensagem de JOIN_ROOM
        const joinData = {
            joinID: this.room.address,
            roomPassword: validatedOptions.password || '',
            guest: this.account.guest,
            dbid: 2, // Valor padrão
            version: this.PROTOCOL_VERSION,
            peerID: validatedOptions.peerID || this.peerID,
            bypass: this.room.bypass || '',
            avatar: this.avatar
        };

        if (this.account.guest) {
            (joinData as any).guestName = this.account.username;
        } else {
            (joinData as any).token = this.token;
        }

        this.sendMessage(CLIENT_MESSAGE_TYPES.JOIN_ROOM, joinData);
    }

    /**
     * Define o endereço da sala.
     * @param {any} addressInfo - Informações de endereço da sala.
     */
    private setAddress(addressInfo: any): void {
        if (!addressInfo.address || !addressInfo.roomname || !addressInfo.server) {
            throw new Error('Invalid room address information');
        }

        this.room.address = addressInfo.address;
        this.room.name = addressInfo.roomname;
        this.room.server = addressInfo.server;
        this.room.bypass = addressInfo.bypass || '';

        if (this.server !== addressInfo.server) {
            this.server = addressInfo.server;
        }
    }

    /**
     * Obtém informações de endereço da sala a partir de uma URL/ID.
     * (Implementação baseada no bonkbot original)
     * @param {string} url - URL ou ID da sala.
     * @returns {Promise<any>} Informações de endereço.
     */
    private async getAddressFromUrl(url: string): Promise<any> {
        // Lógica de regex para extrair ID e bypass
        const regex = /\/(\d{6})([a-zA-Z0-9]{5})?$/;
        const match = url.match(regex);

        if (!match) {
            return null;
        }

        const id = match[1];
        const bypass = match[2] || '';

        const data = new URLSearchParams();
        data.append('joinID', id);

        try {
            // TODO: Implementar httpsAgent se necessário para ignorar certificados
            const response = await axios.post(API.AUTOJOIN, data.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                // httpsAgent: httpsAgent // Necessário importar e configurar
            });

            const result = response.data;

            if (result.r === 'success') {
                result.bypass = bypass;
            }

            return result;
        } catch (error) {
            // console.error('Error getting join link:', error);
            throw error;
        }
    }

    getShareLink(){
		return "https://bonk.io/" + this.room.dbid + this.room.bypass;
	}

    /**
     * Manipula os pacotes recebidos do servidor.
     * @param {any} packet - Pacote analisado.
     */
    private handlePacket(packet: any): void {
        // TODO: Implementar a lógica de autoHandlePacket do bonkbot
        // Por enquanto, apenas emite o evento
        this.emit('packet', packet);

        switch (packet.type) {
            case SERVER_MESSAGE_TYPES.ROOM_SHARE_LINK:
                // O servidor responde com o ID da sala e o bypass após a criação
                this.room.dbid = packet.data.roomId;
                this.room.bypass = packet.data.roomBypass;
                this.emit('ROOM_SHARE_LINK', { url: this.getShareLink() });
                break;

            case SERVER_MESSAGE_TYPES.JOIN_ROOM:
                // Lógica de JOIN_ROOM (configurar game.id, game.host, room.id, players)
                this.game.id = packet.data.myid;
                this.game.host = packet.data.hostid;
                this.room.id = packet.data.roomid;
                this.room.bypass = packet.data.roombypass;
                this.room.teamsLocked = packet.data.teamsLocked;

                // Adicionar jogadores (playerdata)
                if (packet.data.playerdata && Array.isArray(packet.data.playerdata)) {
                    for (let i = 0; i < packet.data.playerdata.length; i++) {
                        const playerData = packet.data.playerdata[i];
                        if (playerData) {
                            // Mapear e adicionar jogador (simplificado)
                            this.players.set(i, {
                                id: i,
                                username: playerData.userName,
                                guest: playerData.guest,
                                peerID: playerData.peerID,
                                // ... outros campos
                            } as Player);
                        }
                    }
                }
                this.emit('JOIN', { game: this.game, room: this.room, players: this.players });
                break;

            case SERVER_MESSAGE_TYPES.CHAT_MESSAGE:
                // Lógica de CHAT_MESSAGE
                const player = this.players.get(packet.id);
                this.emit('CHAT_MESSAGE', { player, message: packet.message });
                break;

            case SERVER_MESSAGE_TYPES.TIMESYNC:
                // Lógica de TIMESYNC (opcional, apenas para rastrear latência)
                // this.timeSync.last_sync = packet.time;
                // this.timeSync.latency = Date.now() - this.timeSync.last_sync;
                break;

            // TODO: Adicionar outros casos importantes (PLAYER_JOIN, PLAYER_LEAVE, GAME_START, etc.)
            default:
                // console.log(`Unhandled packet type: ${packet.type}`);
                break;
        }
    }
}
