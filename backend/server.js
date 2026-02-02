const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Certifique-se de que o arquivo service-account.json está na mesma pasta
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 👇 Conecta com o Banco de Dados Firestore
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// Rota de Teste (Ping)
app.get('/', (req, res) => {
    res.send('⚖️ Backend Jurídico AdvogaFlow - Online!');
});

// ==========================================
// 🔐 AUTENTICAÇÃO E SEGURANÇA
// ==========================================

app.post('/api/login-seguro', async (req, res) => {
    const token = req.body.token;
    if (!token) return res.status(401).send('Token obrigatório');

    try {
        // 1. O Google confirma quem é a pessoa
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        // 2. O Backend vai no banco ver o "crachá" (role)
        const userDoc = await db.collection('usuarios').doc(uid).get();

        let userRole = 'CLIENT'; // Padrão: Se não tiver cadastro, é cliente
        
        if (userDoc.exists) {
            userRole = userDoc.data().role; // Pega o papel (ADMIN ou CLIENT)
        }

        console.log(`👤 Login: ${decodedToken.email} | Função: ${userRole}`);

        res.json({ 
            mensagem: 'Acesso Liberado!', 
            usuario: decodedToken.email,
            role: userRole 
        });

    } catch (error) {
        console.error('Erro Auth:', error);
        res.status(403).send('Token inválido ou erro no servidor');
    }
});

// ==========================================
// 📂 CRUD DE PROCESSOS (Módulo Advogado)
// ==========================================

// Listar todos os processos
app.get('/api/processos', async (req, res) => {
    try {
        const snapshot = await db.collection('processos').get();
        const listaProcessos = [];
        snapshot.forEach(doc => {
            listaProcessos.push({ id: doc.id, ...doc.data() });
        });
        res.json(listaProcessos);
    } catch (error) {
        res.status(500).send('Erro ao buscar processos');
    }
});

// Pegar UM processo específico (Para a tela de Detalhes)
app.get('/api/processos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const doc = await db.collection('processos').doc(id).get();
        
        if (!doc.exists) {
            return res.status(404).send('Processo não encontrado');
        }

        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).send('Erro ao buscar processo');
    }
});

// Criar novo processo
app.post('/api/processos', async (req, res) => {
    try {
        const novoProcesso = req.body; 
        const resposta = await db.collection('processos').add(novoProcesso);
        res.json({ id: resposta.id, mensagem: 'Processo salvo com sucesso!' });
    } catch (error) {
        res.status(500).send('Erro ao salvar processo');
    }
});

// Atualizar processo
app.put('/api/processos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const dadosNovos = req.body;
        await db.collection('processos').doc(id).update(dadosNovos);
        res.json({ mensagem: 'Processo atualizado!' });
    } catch (error) {
        res.status(500).send('Erro ao atualizar');
    }
});

// Excluir processo
app.delete('/api/processos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await db.collection('processos').doc(id).delete();
        res.json({ mensagem: 'Processo deletado!' });
    } catch (error) {
        res.status(500).send('Erro ao deletar');
    }
});

// ==========================================
// ⏳ MOTOR DE PRAZOS E ETAPAS (NOVO!)
// ==========================================

// 1. Listar etapas de um processo (Ordenado por data)
app.get('/api/processos/:id/etapas', async (req, res) => {
    try {
        const procId = req.params.id;
        // Pega a sub-coleção 'etapas' e ordena pela data limite
        const snapshot = await db.collection('processos').doc(procId).collection('etapas').orderBy('dataLimite').get();
        
        const etapas = [];
        snapshot.forEach(doc => etapas.push({ id: doc.id, ...doc.data() }));
        
        res.json(etapas);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao buscar etapas');
    }
});

// 2. Criar uma nova etapa/prazo
app.post('/api/processos/:id/etapas', async (req, res) => {
    try {
        const procId = req.params.id;
        const novaEtapa = {
            titulo: req.body.titulo,
            dataLimite: req.body.dataLimite,
            status: 'PENDENTE', // Começa sempre pendente
            criadoEm: new Date().toISOString()
        };

        const resp = await db.collection('processos').doc(procId).collection('etapas').add(novaEtapa);
        res.json({ id: resp.id, mensagem: 'Prazo criado!' });
    } catch (error) {
        res.status(500).send('Erro ao criar etapa');
    }
});

// 3. Concluir uma etapa (Checkbox)
app.put('/api/processos/:id/etapas/:etapaId', async (req, res) => {
    try {
        const { id, etapaId } = req.params;
        const status = req.body.status; // 'CONCLUIDO' ou 'PENDENTE'

        await db.collection('processos').doc(id).collection('etapas').doc(etapaId).update({ status: status });
        res.json({ mensagem: 'Status atualizado!' });
    } catch (error) {
        res.status(500).send('Erro ao atualizar etapa');
    }
});

// ==========================================
// 🚀 INICIALIZAÇÃO
// ==========================================
app.listen(3000, () => {
    console.log('✅ Servidor AdvogaFlow rodando na porta 3000');
    console.log('📡 Rotas de Prazos e Login Inteligente ATIVAS.');
});