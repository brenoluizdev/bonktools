#!/usr/bin/env node
/**
 * Extract certificate chain directly from bonk.io server
 * This avoids curl, HTTP downloads, proxies, and firewall blocks
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', 'bonk_fullchain.pem');
const BONK_HOST = 'b2ny1.bonk.io';
const BONK_PORT = 443;

function main() {
    console.log('Extracting certificate chain directly from bonk.io server...');

    try {
        // Windows não suporta < /dev/null
        // Usamos echo. para encerrar a conexão corretamente
        const cmd = `echo.|openssl s_client -showcerts -connect ${BONK_HOST}:${BONK_PORT}`;

        const output = execSync(cmd, {
            encoding: 'utf8',
            maxBuffer: 20 * 1024 * 1024
        });

        const certs = output.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);

        if (!certs || certs.length === 0) {
            throw new Error('No certificates found in server response');
        }

        const uniqueCerts = [...new Set(certs)];

        fs.writeFileSync(OUTPUT_FILE, uniqueCerts.join('\n\n'), 'utf8');

        console.log(`✓ Extracted ${uniqueCerts.length} certificate(s)`);
        console.log(`✓ Full chain saved to: ${OUTPUT_FILE}`);
        console.log('✓ Chain captured directly from the server 🔥');
    } catch (err) {
        console.error('Failed to extract certificates:', err.message);
        process.exit(1);
    }
}


if (require.main === module) {
    main();
}

module.exports = { main };
