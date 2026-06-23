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

// 2. ROTA DE DOWNLOAD
app.get('/baixar-relatorio', async (req, res) => {
    try {
        console.log("1. Buscando dados de contas a pagar na API V2...");
        
        const opcoesData = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatadorBrasil = new Intl.DateTimeFormat('pt-BR', opcoesData);
        const dataDeHoje = formatadorBrasil.format(new Date()); 
        
        console.log(`Data alvo: ${dataDeHoje}`);

        const formParams = new URLSearchParams();
        formParams.append('token', MEU_TOKEN_FIXO);
        formParams.append('formato', 'JSON');
        formParams.append('situacao', 'aberto');
        formParams.append('data_ini', dataDeHoje);
        formParams.append('data_fim', dataDeHoje);

        const dadosResponse = await axios.post(OLIST_API_URL, formParams);

        if (dadosResponse.data.retorno.status === 'Erro') {
            throw new Error(`Recusa da API: ${dadosResponse.data.retorno.erros[0].erro}`);
        }

        const listaBruta = dadosResponse.data.retorno.contas || []; 
        const contasAPagar = listaBruta.map(item => item.conta);

        const contasFiltradas = contasAPagar.filter(conta => conta.data_vencimento === dataDeHoje);

        if (contasFiltradas.length === 0) {
            return res.status(404).send(`Não há contas em aberto com vencimento para hoje (${dataDeHoje}).`);
        }

        const worksheet = xlsx.utils.json_to_sheet(contasFiltradas);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Contas_Hoje');

        const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        const nomeArquivo = `Relatorio_Olist_${dataDeHoje.replace(/\//g, '_')}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);

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
