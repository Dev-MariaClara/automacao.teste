// 1. Carrega as variáveis do arquivo .env (que não vai para o Git)
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURAÇÕES DA API (OLIST ERP / TINY V2)
// ==========================================
const OLIST_API_URL = 'https://api.tiny.com.br/api2/contas.pagar.pesquisa.php'; 

// 2. O token é lido de forma segura do arquivo .env
const MEU_TOKEN_FIXO = process.env.MEU_TOKEN_OLIST; 

app.get('/baixar-relatorio', async (req, res) => {
    try {
        console.log("1. Buscando dados de contas a pagar na API V2...");
        
        // Data dinâmica no fuso do Brasil
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

        // Filtro rigoroso para garantir que só cheguem dados de hoje
        const contasFiltradas = contasAPagar.filter(conta => conta.data_vencimento === dataDeHoje);

        if (contasFiltradas.length === 0) {
            console.log(`Atenção: Nenhuma conta com vencimento para ${dataDeHoje} foi encontrada.`);
            return res.status(404).send(`Não há contas em aberto para hoje (${dataDeHoje}).`);
        }

        console.log(`Sucesso: ${contasFiltradas.length} contas encontradas. Montando Excel...`);

        const worksheet = xlsx.utils.json_to_sheet(contasFiltradas);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Contas_Hoje');

        const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        console.log("3. Enviando arquivo para download...");
        const nomeArquivo = `Relatorio_Olist_${dataDeHoje.replace(/\//g, '_')}.xlsx`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);

        console.log("✅ Processo finalizado com sucesso!");

    } catch (error) {
        console.log("\n❌ --- DETALHES DO ERRO ---");
        console.log(error.message);
        console.log("-------------------------------------\n");
        res.status(500).send("Erro ao gerar o relatório.");
    }
});
// Redireciona a raiz para o endpoint de download
app.get('/', (req, res) => {
    res.redirect('/baixar-relatorio');
});
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando! Link: http://localhost:${PORT}/baixar-relatorio`);
});
