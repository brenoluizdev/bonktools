// Funções de validação mockadas para permitir a compilação inicial
// Devem ser implementadas com a lógica do bonkbot original

import { CreateRoomOptions, JoinOptions } from '../connection/BonkConnection';

export function validateAccount(account: any): any {
    if (!account || !account.username) {
        throw new Error('Account must have a username.');
    }
    account.guest = account.guest ?? true;
    return account;
}

export function validateRoomOptions(options: CreateRoomOptions): CreateRoomOptions {
    // Implementação de validação de opções de sala
    return options;
}

export function validateJoinOptions(options: JoinOptions): JoinOptions {
    // Implementação de validação de opções de entrada
    return options;
}

export function validateString(value: any, name: string): void {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Invalid value for ${name}: must be a non-empty string.`);
    }
}
