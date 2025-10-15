import { buscarFragmentosRelevantes } from "./buscador_referencias.js";
import dotenv from "dotenv";
dotenv.config();

const pregunta = "Qué debo observar cuando hay cambios en el sueño del paciente?";
const resultado = await buscarFragmentosRelevantes(pregunta);

console.log("🔍 Fragmentos más relevantes:\n");
console.log(resultado);
