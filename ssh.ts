import { Client } from "ssh2";

export interface SshSessionConfig {
  id?: string;
  host: string;
  port?: number;
  username: string;
  password?: string | null;
  privateKey?: string | null;
  passphrase?: string | null;
  jumpHostId?: string | null;
  jumpHost?: SshSessionConfig | null;
}

export interface ConnectedSshSession {
  client: Client;
  jumpClient?: Client;
}

export const normalizePrivateKey = (key: string | null | undefined): string | null | undefined => {
  if (!key) return key;
  let pk = key.replace(/\r\n/g, '\n').trim() + '\n';
  if (pk.split('\n').length <= 3) {
    const match = pk.match(/(-----BEGIN [^-]+-----)\s*(.*?)\s*(-----END [^-]+-----)/s);
    if (match) {
      const header = match[1];
      const body = match[2].replace(/\s+/g, '');
      const footer = match[3];
      const bodyLines = body.match(/.{1,70}/g)?.join('\n') || body;
      pk = `${header}\n${bodyLines}\n${footer}\n`;
    }
  }
  return pk;
};

const buildConnectConfig = (session: SshSessionConfig, sock?: any) => {
  const config: any = {
    host: session.host,
    port: session.port || 22,
    username: session.username,
    readyTimeout: 10000
  };

  if (sock) {
    config.sock = sock;
    delete config.host;
    delete config.port;
  }

  if (session.password) {
    config.password = session.password;
  }

  if (session.privateKey) {
    config.privateKey = normalizePrivateKey(session.privateKey);
    if (session.passphrase) {
      config.passphrase = session.passphrase;
    }
  }

  return config;
};

const connectClient = (session: SshSessionConfig, sock?: any): Promise<Client> => {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const onReady = () => {
      client.off('error', onError);
      client.on('error', () => {});
      resolve(client);
    };
    const onError = (err: any) => {
      client.off('ready', onReady);
      reject(err);
    };

    client.once('ready', onReady);
    client.once('error', onError);
    client.connect(buildConnectConfig(session, sock));
  });
};

const forwardThroughJumpHost = (jumpClient: Client, session: SshSessionConfig): Promise<any> => {
  return new Promise((resolve, reject) => {
    jumpClient.forwardOut(
      '127.0.0.1',
      0,
      session.host,
      session.port || 22,
      (err, stream) => {
        if (err) reject(err);
        else resolve(stream);
      }
    );
  });
};

export async function connectSshSession(session: SshSessionConfig): Promise<ConnectedSshSession> {
  if (!session.jumpHost) {
    return { client: await connectClient(session) };
  }

  const jumpClient = await connectClient(session.jumpHost);
  try {
    const tunnel = await forwardThroughJumpHost(jumpClient, session);
    const client = await connectClient(session, tunnel);
    return { client, jumpClient };
  } catch (err) {
    jumpClient.end();
    throw err;
  }
}

export async function connectStoredSshSession(db: any, session: SshSessionConfig, userId: number): Promise<ConnectedSshSession> {
  if (!session.jumpHostId) {
    return connectSshSession(session);
  }

  if (session.jumpHostId === session.id) {
    throw new Error("A session cannot use itself as a jump host.");
  }

  const jumpHost = await db.get(
    'SELECT * FROM sessions WHERE id = ? AND userId = ?',
    [session.jumpHostId, userId]
  );

  if (!jumpHost) {
    throw new Error("Jump host session not found.");
  }

  if (jumpHost.jumpHostId) {
    throw new Error("Nested jump hosts are not supported yet.");
  }

  return connectSshSession({ ...session, jumpHost });
}

export function closeSshSession(connection: ConnectedSshSession | null | undefined) {
  connection?.client.end();
  connection?.jumpClient?.end();
}
