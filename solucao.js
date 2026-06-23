require('dotenv').config();
const express = require('express');
const axios = require('axios');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

const OLIST_API_URL = 'https://api.tiny.com.br/api2/contas.pagar.pesquisa.php'; 
const MEU_TOKEN_FIXO = process.env.MEU_TOKEN_OLIST; 

// 1. ROTA RAIZ: Redireciona para o download automaticamente
app.get('/', (req, res) => {
    res.redirect('/baixar-relatorio');
});

// 2. ROTA DE DOWNLOAD (Agora puxando TUDO)
app.get('/baixar-relatorio', async (req, res) => {
    try {
        console.log("1. Buscando TODAS as contas a pagar na API V2...");

        // Parâmetros da API sem os filtros de data
        const formParams = new URLSearchParams();
        formParams.append('token', MEU_TOKEN_FIXO);
        formParams.append('formato', 'JSON');
        formParams.append('situacao', 'aberto');

        const dadosResponse = await axios.post(OLIST_API_URL, formParams);

        if (dadosResponse.data.retorno.status === 'Erro') {
            throw new Error(`Recusa da API: ${dadosResponse.data.retorno.erros[0].erro}`);
        }

        const listaBruta = dadosResponse.data.retorno.contas || []; 
        const contasAPagar = listaBruta.map(item => item.conta);

        // Como queremos todas, não há mais o .filter() aqui
        if (contasAPagar.length === 0) {
            return res.status(404).send("Não há nenhuma conta em aberto cadastrada no momento.");
        }

        console.log(`Sucesso: ${contasAPagar.length} contas encontradas. Montando Excel...`);

        // Monta o Excel com todas as contas
        const worksheet = xlsx.utils.json_to_sheet(contasAPagar);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Todas_Contas');

        const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        // Nome do arquivo atualizado
        res.setHeader('Content-Disposition', 'attachment; filename="Relatorio_Olist_Completo.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);

        console.log("✅ Processo finalizado com sucesso!");

    } catch (error) {
        console.log("❌ Erro:", error.message);
        res.status(500).send("Erro ao gerar o relatório.");
    }
});

// 3. ROTA CORINGA: Qualquer outro acesso vai para o download
app.use((req, res) => {
    res.redirect('/baixar-relatorio');
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});