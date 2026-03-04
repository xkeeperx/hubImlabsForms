# Onboarding Form - Proyecto Web con Integración Monday.com

Proyecto web completo listo para producción en un servidor Linux VPS (Ubuntu). Incluye una landing page pública y una aplicación de formulario integrada con Monday.com.

## 📋 Tabla de Contenidos

- [Stack Tecnológico](#stack-tecnológico)
- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Desarrollo Local](#desarrollo-local)
- [Despliegue en Producción](#despliegue-en-producción)
- [Configuración de Nginx](#configuración-de-nginx)
- [Cómo obtener los Column IDs de Monday.com](#cómo-obtener-los-column-ids-de-mondaycom)
- [Estructura del Proyecto](#estructura-del-proyecto)

---

## 🛠 Stack Tecnológico

- **Backend:** Node.js con Express.js
- **Frontend:** HTML5 + CSS3 + JavaScript Vanilla
- **Gestor de procesos:** PM2 para producción
- **Variables de entorno:** archivo `.env` con `dotenv`
- **Dependencias clave:** `express`, `axios`, `dotenv`, `cors`, `morgan`

---

## 📦 Requisitos Previos

- Node.js 18+ (LTS recomendado)
- npm (viene incluido con Node.js)
- Acceso a un servidor Linux VPS (Ubuntu) para producción
- Cuenta de Monday.com con API access

---

## 🚀 Instalación

1. **Clonar el repositorio:**

```bash
git clone <repo-url>
cd onboarding-form
```

2. **Instalar dependencias:**

```bash
npm install
```

3. **Configurar variables de entorno:**

```bash
cp .env.example .env
```

4. **Editar el archivo `.env` con tus valores reales:**

```env
PORT=3000
MONDAY_API_KEY=tu_api_key_aqui
MONDAY_BOARD_ID=123456789
MONDAY_STATUS_COLUMN_ID=estado
MONDAY_STATUS_VALUE=Completado
MONDAY_STORE_COLUMN_ID=numero_tienda
```

---

## ⚙️ Configuración

### Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto donde correrá el servidor (default: 3000) |
| `MONDAY_API_KEY` | Tu API token de Monday.com |
| `MONDAY_BOARD_ID` | ID numérico del board de Monday.com |
| `MONDAY_STATUS_COLUMN_ID` | Column ID de la columna "Estado" |
| `MONDAY_STATUS_VALUE` | Valor del estado tras guardar (ej: "Completado") |
| `MONDAY_STORE_COLUMN_ID` | Column ID de la columna "Número de Tienda" |

### Mapeo de Campos del Formulario

En el archivo [`public/js/form.js`](public/js/form.js:1), debes actualizar el objeto `columnMapping` con los IDs de columna reales de tu board de Monday.com:

```javascript
const columnMapping = {
    firstName: 'texto',           // Reemplaza con el ID de columna real
    lastName: 'texto2',           // Reemplaza con el ID de columna real
    email: 'email',               // Reemplaza con el ID de columna real
    phone: 'telefono',            // Reemplaza con el ID de columna real
    position: 'estado1',          // Reemplaza con el ID de columna real
    storeAddress: 'texto4',       // Reemplaza con el ID de columna real
    city: 'texto5',               // Reemplaza con el ID de columna real
    region: 'texto6',             // Reemplaza con el ID de columna real
    openDate: 'fecha',            // Reemplaza con el ID de columna real
    teamSize: 'estado2',          // Reemplaza con el ID de columna real
    comments: 'texto_largo'       // Reemplaza con el ID de columna real
};
```

---

## 💻 Desarrollo Local

Para ejecutar el servidor en modo desarrollo con recarga automática:

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

---

## 🌐 Despliegue en Producción

### 1. Instalar PM2 globalmente

PM2 es un gestor de procesos para Node.js que mantiene tu aplicación corriendo en producción.

```bash
npm install -g pm2
```

### 2. Iniciar la aplicación con PM2

```bash
pm2 start server.js --name "onboarding-form"
```

### 3. Guardar la lista de procesos de PM2

```bash
pm2 save
```

### 4. Configurar PM2 para iniciar automáticamente al reiniciar el servidor

```bash
pm2 startup
```

Este comando te mostrará un comando adicional que debes ejecutar. Por ejemplo:

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u tu_usuario --hp /home/tu_usuario
```

### 5. Comandos útiles de PM2

```bash
# Ver el estado de la aplicación
pm2 status

# Ver logs en tiempo real
pm2 logs onboarding-form

# Reiniciar la aplicación
pm2 restart onboarding-form

# Detener la aplicación
pm2 stop onboarding-form

# Eliminar la aplicación de PM2
pm2 delete onboarding-form
```

---

## 🔧 Configuración de Nginx (Opcional pero Recomendado)

Nginx puede actuar como reverse proxy para tu aplicación, proporcionando SSL, mejor rendimiento y seguridad.

### 1. Instalar Nginx

```bash
sudo apt update
sudo apt install nginx
```

### 2. Crear un archivo de configuración para tu sitio

```bash
sudo nano /etc/nginx/sites-available/onboarding-form
```

### 3. Agregar la siguiente configuración:

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Habilitar el sitio

```bash
sudo ln -s /etc/nginx/sites-available/onboarding-form /etc/nginx/sites-enabled/
```

### 5. Verificar la configuración de Nginx

```bash
sudo nginx -t
```

### 6. Reiniciar Nginx

```bash
sudo systemctl restart nginx
```

### 7. Configurar SSL con Let's Encrypt (Opcional)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```

---

## 🔑 Cómo obtener los Column IDs de Monday.com

### Obtener el Board ID

1. Abre tu board en Monday.com
2. El Board ID es el número que aparece en la URL después de `/boards/`
   - Ejemplo: `https://monday.com/boards/123456789` → Board ID: `123456789`

### Obtener los Column IDs

#### Método 1: Usando la API de Monday.com

1. Ve a [Monday.com Developers](https://developer.monday.com/api-reference/docs/graphql-api)
2. Usa el API Playground con tu API token
3. Ejecuta la siguiente query:

```graphql
query {
  boards(ids: [TU_BOARD_ID]) {
    columns {
      id
      title
      type
    }
  }
}
```

4. La respuesta te mostrará todos los IDs de columna con sus títulos:

```json
{
  "data": {
    "boards": [
      {
        "columns": [
          {
            "id": "texto",
            "title": "Nombre",
            "type": "text"
          },
          {
            "id": "email",
            "title": "Correo Electrónico",
            "type": "email"
          }
        ]
      }
    ]
  }
}
```

#### Método 2: Usando las herramientas de desarrollador del navegador

1. Abre tu board en Monday.com
2. Presiona F12 para abrir las herramientas de desarrollador
3. Ve a la pestaña "Network"
4. Haz alguna acción en el board (como cambiar una celda)
5. Busca una solicitud GraphQL en la red
6. En la respuesta, busca los IDs de columna

### Obtener tu API Key de Monday.com

1. Ve a monday.com e inicia sesión
2. Haz clic en tu avatar en la esquina superior izquierda
3. Selecciona "Developers"
4. En la sección "API tokens", haz clic en "Copy" para copiar tu token
5. Pega este token en tu archivo `.env` como `MONDAY_API_KEY`

---

## 📁 Estructura del Proyecto

```
/onboarding-form
│
├── server.js                  # Servidor principal Express
├── .env                       # Variables de entorno (NO subir a git)
├── .env.example               # Ejemplo de variables sin valores sensibles
├── .gitignore                 # Archivos ignorados por git
├── package.json               # Dependencias del proyecto
├── README.md                  # Este archivo
│
├── /public                    # Archivos estáticos servidos por Express
│   ├── index.html             # Landing page
│   ├── form.html              # Página del formulario
│   ├── /css
│   │   ├── styles.css         # Estilos globales y landing
│   │   └── form.css           # Estilos del formulario
│   └── /js
│       ├── main.js            # JS de la landing
│       └── form.js            # Lógica del formulario + fetch al backend
│
└── /routes
    └── monday.js              # Rutas API para Monday.com
```

---

## 🔒 Seguridad

- **Nunca** expongas la API Key de Monday.com en el frontend
- El archivo `.env` está incluido en `.gitignore` para no ser subido a git
- Asegúrate de configurar HTTPS en producción usando Nginx con Let's Encrypt
- Mantén tus dependencias actualizadas: `npm audit fix`

---

## 📝 Notas Adicionales

### Flujo del Formulario

1. **Búsqueda de Tienda:** El usuario ingresa el número de tienda
2. **Validación:** El backend busca en Monday.com una tienda con ese número y estado "pendiente"
3. **Selección:** Si se encuentra, el usuario confirma la selección
4. **Formulario:** Se muestra el formulario completo para diligenciar
5. **Guardado:** Los datos se envían al backend que actualiza el item en Monday.com y cambia el estado

### Personalización

- Los colores y estilos se pueden personalizar fácilmente modificando las variables CSS en [`public/css/styles.css`](public/css/styles.css:1) y [`public/css/form.css`](public/css/form.css:1)
- El contenido de las cards de servicios se puede editar en [`public/index.html`](public/index.html:1)
- Los campos del formulario se pueden modificar en [`public/form.html`](public/form.html:1)

---

## 📄 Licencia

ISC

---

## 🤝 Soporte

Para problemas o preguntas, por favor abre un issue en el repositorio o contacta al equipo de desarrollo.
