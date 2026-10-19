---
type: "query"
date: "2026-10-18T07:41:44.601Z"
question: "Apakah barang, klien, PO, SQ, dan SO Accurate ketiga PT terbaca setelah Google login pada intranet.davay.space?"
contributor: "graphify"
source_nodes: ["accurate_service_listdocuments", "accurate_service_searchitems", "accurate_service_searchcustomers", "accurate_transport_createaccuratetransport", "path_route_get"]
---

# Q: Apakah barang, klien, PO, SQ, dan SO Accurate ketiga PT terbaca setelah Google login pada intranet.davay.space?

## Answer

Diverifikasi 18 Oktober 2026 dengan sesi master_admin. 15 daftar dan 14 sampel detail GET berhasil, disertai 15 pemeriksaan antarmuka. Total API GGS: barang 4779, klien 2019, PO 1560, SQ 3, SO 1749. RSP: 758, 371, 79, 0, 1201. SRI: 2252, 933, 175, 2393, 2702. SQ RSP kosong normal. Seluruh detail transaksi sesuai PT sesi. Tidak ada operasi save/delete/approve Accurate; draft dan audit bisnis GGS sebelum/sesudah 0. Laporan: docs/accurate-connection-check.md.

## Source Nodes

- accurate_service_listdocuments
- accurate_service_searchitems
- accurate_service_searchcustomers
- accurate_transport_createaccuratetransport
- path_route_get