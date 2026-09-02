# @lumen/storage

Abstração de **armazenamento de arquivos** para Lumen, com implementação baseada no filesystem local (`LocalStorage`) e interface `FileStorage` pronta para S3/GCS/Azure.

```ts
import { LocalStorage } from '@lumen/storage';
```

---

## LocalStorage

Implementação local em disco — ótima para desenvolvimento. Para produção, implemente `FileStorage` (S3, GCS etc.).

```ts
const storage = new LocalStorage({ basePath: './uploads' });

// Upload
await storage.put('avatars/user-1.jpg', imageBuffer, { contentType: 'image/jpeg' });

// Download
const file = await storage.get('avatars/user-1.jpg'); // { data, metadata }

// Listar
const files = await storage.list('avatars/');

// URL assinada
const url = await storage.getSignedUrl('avatars/user-1.jpg', 3600_000);
```

### `StorageOptions`

| Opção | Padrão | Descrição |
| --- | --- | --- |
| `basePath?` | `./storage` | Diretório base. |
| `baseUrl?` | `http://localhost:3000` | URL base para URLs assinadas. |

---

## Interface `FileStorage`

Implemente esta interface para providers de produção (S3, GCS, Azure).

```ts
interface FileStorage {
  put(key, data: Buffer, metadata?): Promise<FileMetadata>;
  get(key): Promise<{ data: Buffer; metadata: FileMetadata } | undefined>;
  delete(key): Promise<boolean>;
  list(prefix?): Promise<FileMetadata[]>;
  getSignedUrl(key, expiresInMs?): Promise<string>;
}
```

---

## `FileMetadata`

```ts
interface FileMetadata {
  key: string;
  size: number;
  contentType?: string;
  lastModified: Date;
  metadata?: Record<string, string>;
}
```

---

## Notas

- `get`/`delete`/`list` devolvem `undefined`/`false`/`[]` em caso de ausência ou erro, em vez de lançar.
- `getSignedUrl` gera um token base64 (`{ key, expires }`) anexado à URL — não é uma assinatura criptográfica real; para produção, use o mecanismo do provider (ex.: assinatura do S3).
- `list` apenas lista **arquivos diretos** do prefixo (não recursivo).
