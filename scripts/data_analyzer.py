#!/usr/bin/env python3
"""
SIPANDU PUPR - Python Fast Data Analytics Engine
Permen PUPR No. 22/PRT/M/2018
High-speed statistical computation and vulnerability modeling for building assessments.
"""

import sys
import json
import time
import math
import statistics

def analyze_assessments(data):
    start_time = time.time()
    
    if not isinstance(data, list):
        data = []
        
    total_buildings = len(data)
    if total_buildings == 0:
        return {
            "success": True,
            "engine": "Python 3 Analytics Engine",
            "executionTimeMs": round((time.time() - start_time) * 1000, 2),
            "totalBuildings": 0,
            "summary": {
                "totalCost": 0,
                "averageDamagePercent": 0,
                "damageCounts": {"Rusak Ringan": 0, "Rusak Sedang": 0, "Rusak Berat": 0},
            },
            "componentVulnerability": [],
            "priorityRankings": {"P1_Mendesak": 0, "P2_Rehabilitasi": 0, "P3_Pemeliharaan": 0},
            "topPriorityBuildings": [],
            "kecamatanStats": {},
            "recommendations": ["Belum ada data penilaian untuk dianalisis."]
        }

    # 1. Financial & Damage Aggregations
    costs = []
    damage_percents = []
    damage_counts = {"Rusak Ringan": 0, "Rusak Sedang": 0, "Rusak Berat": 0}
    kecamatan_map = {}
    
    # Track component damage sums
    # Components: Pondasi, Kolom, Balok, Rangka Atap, Penutup Atap, Dinding, Lantai, Utilitas
    components_tracker = {
        "Pondasi": {"totalDamage": 0, "count": 0, "weight": 0.15, "category": "Struktur"},
        "Kolom": {"totalDamage": 0, "count": 0, "weight": 0.25, "category": "Struktur"},
        "Balok": {"totalDamage": 0, "count": 0, "weight": 0.20, "category": "Struktur"},
        "Rangka Atap": {"totalDamage": 0, "count": 0, "weight": 0.15, "category": "Struktur"},
        "Penutup Atap": {"totalDamage": 0, "count": 0, "weight": 0.08, "category": "Arsitektur"},
        "Dinding": {"totalDamage": 0, "count": 0, "weight": 0.10, "category": "Arsitektur"},
        "Lantai": {"totalDamage": 0, "count": 0, "weight": 0.04, "category": "Arsitektur"},
        "Utilitas": {"totalDamage": 0, "count": 0, "weight": 0.03, "category": "Utilitas"}
    }
    
    priority_counts = {"P1_Mendesak": 0, "P2_Rehabilitasi": 0, "P3_Pemeliharaan": 0}
    scored_buildings = []

    for item in data:
        cost = float(item.get('roundedRehabCost') or item.get('estimatedRehabCost') or 0)
        costs.append(cost)
        
        dmg = float(item.get('overallDamagePercent') or item.get('damagePercent') or 0)
        damage_percents.append(dmg)
        
        classification = item.get('damageClassification') or 'Rusak Ringan'
        if 'Berat' in classification:
            damage_counts['Rusak Berat'] += 1
        elif 'Sedang' in classification:
            damage_counts['Rusak Sedang'] += 1
        else:
            damage_counts['Rusak Ringan'] += 1

        # Wilayah stats
        kec = item.get('kecamatan') or 'Lainnya'
        if kec not in kecamatan_map:
            kecamatan_map[kec] = {
                "count": 0,
                "totalCost": 0,
                "heavyCount": 0,
                "moderateCount": 0,
                "lightCount": 0,
                "totalDamagePercent": 0
            }
        kec_stat = kecamatan_map[kec]
        kec_stat["count"] += 1
        kec_stat["totalCost"] += cost
        kec_stat["totalDamagePercent"] += dmg
        if 'Berat' in classification:
            kec_stat["heavyCount"] += 1
        elif 'Sedang' in classification:
            kec_stat["moderateCount"] += 1
        else:
            kec_stat["lightCount"] += 1

        # Process component damage if available
        comp_scores = item.get('componentScores') or {}
        structural_damage = 0
        if isinstance(comp_scores, dict):
            for c_key, c_val in comp_scores.items():
                c_name = str(c_key).lower()
                dmg_val = float(c_val.get('damagePercent', 0) if isinstance(c_val, dict) else (c_val or 0))
                
                matched = False
                for target_comp in components_tracker.keys():
                    if target_comp.lower() in c_name:
                        components_tracker[target_comp]["totalDamage"] += dmg_val
                        components_tracker[target_comp]["count"] += 1
                        matched = True
                        if components_tracker[target_comp]["category"] == "Struktur":
                            structural_damage += dmg_val
                        break
                if not matched and 'struktur' in c_name:
                    components_tracker["Kolom"]["totalDamage"] += dmg_val
                    components_tracker["Kolom"]["count"] += 1
                    structural_damage += dmg_val
        else:
            # Synthetic distribution based on overall damage
            structural_damage = dmg

        # Calculate Priority Risk Index (Permen PUPR)
        # Urgency: Structural Damage * 0.6 + Overall Damage * 0.4 + Category Factor
        category = item.get('buildingCategory') or 'Hunian Masyarakat'
        cat_multiplier = 1.25 if category in ['Kesehatan', 'Pendidikan', 'Gedung Pemerintah'] else 1.0
        
        urgency_score = round((structural_damage * 0.6 + dmg * 0.4) * cat_multiplier, 1)
        
        if urgency_score >= 45.0 or 'Berat' in classification:
            priority_code = 'P1_Mendesak'
            priority_label = 'P1 - Penanganan Mendesak (Bahaya Keruntuhan)'
            priority_counts['P1_Mendesak'] += 1
        elif urgency_score >= 25.0 or 'Sedang' in classification:
            priority_code = 'P2_Rehabilitasi'
            priority_label = 'P2 - Rehabilitasi Sedang'
            priority_counts['P2_Rehabilitasi'] += 1
        else:
            priority_code = 'P3_Pemeliharaan'
            priority_label = 'P3 - Perawatan Rutin'
            priority_counts['P3_Pemeliharaan'] += 1

        scored_buildings.append({
            "id": item.get('id'),
            "code": item.get('code') or item.get('id'),
            "buildingName": item.get('buildingName') or 'Tanpa Nama',
            "category": category,
            "kecamatan": kec,
            "desa": item.get('desa') or '',
            "damageClassification": classification,
            "damagePercent": round(dmg, 2),
            "rehabCost": cost,
            "urgencyScore": urgency_score,
            "priorityCode": priority_code,
            "priorityLabel": priority_label
        })

    # Sort scored buildings by urgency
    scored_buildings.sort(key=lambda x: x['urgencyScore'], reverse=True)

    # 2. Compute Cost Statistics
    total_cost = sum(costs)
    mean_cost = statistics.mean(costs) if costs else 0
    median_cost = statistics.median(costs) if costs else 0
    std_cost = statistics.stdev(costs) if len(costs) > 1 else 0
    mean_damage = statistics.mean(damage_percents) if damage_percents else 0

    # 3. Component Vulnerability Index List
    vuln_list = []
    for comp_name, data_dict in components_tracker.items():
        avg_dmg = (data_dict["totalDamage"] / data_dict["count"]) if data_dict["count"] > 0 else (mean_damage * data_dict["weight"])
        vulnerability_index = round(avg_dmg * data_dict["weight"] * 10, 2)
        vuln_list.append({
            "component": comp_name,
            "category": data_dict["category"],
            "averageDamage": round(avg_dmg, 2),
            "weight": data_dict["weight"],
            "vulnerabilityIndex": vulnerability_index
        })
    vuln_list.sort(key=lambda x: x['vulnerabilityIndex'], reverse=True)

    # 4. Kecamatan Aggregated Summary
    kec_summary = {}
    for k, v in kecamatan_map.items():
        avg_d = round(v["totalDamagePercent"] / v["count"], 2) if v["count"] > 0 else 0
        kec_summary[k] = {
            "buildingCount": v["count"],
            "totalCost": v["totalCost"],
            "averageDamage": avg_d,
            "heavyDamageCount": v["heavyCount"],
            "moderateDamageCount": v["moderateCount"],
            "lightDamageCount": v["lightCount"]
        }

    # 5. Algorithmic Recommendations
    recommendations = []
    if priority_counts["P1_Mendesak"] > 0:
        recommendations.append(
            f"Ditemukan {priority_counts['P1_Mendesak']} gedung prioritas P1 (Kerusakan Berat/Kritis) yang membutuhkan pembatasan akses atau perkuatan darurat (retrofitting) segera untuk mencegah korban jiwa."
        )
    if vuln_list and vuln_list[0]["vulnerabilityIndex"] > 0:
        top_comp = vuln_list[0]
        recommendations.append(
            f"Komponen paling rentan teridentifikasi pada '{top_comp['component']}' ({top_comp['category']}) dengan indeks kerentanan {top_comp['vulnerabilityIndex']}. Disarankan pengawasan khusus pada elemen ini saat perbaikan."
        )
    top_kec = max(kec_summary.items(), key=lambda x: x[1]['totalCost']) if kec_summary else None
    if top_kec:
        recommendations.append(
            f"Kecamatan {top_kec[0]} mencatat estimasi alokasi rehabilitasi terbesar (Rp {top_kec[1]['totalCost']:,.0f}) dengan {top_kec[1]['buildingCount']} gedung terdampak."
        )

    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "success": True,
        "engine": "Python 3.10 Fast Analytics Engine",
        "executionTimeMs": execution_time_ms,
        "totalBuildings": total_buildings,
        "summary": {
            "totalCost": total_cost,
            "meanCost": round(mean_cost, 0),
            "medianCost": round(median_cost, 0),
            "standardDeviationCost": round(std_cost, 0),
            "averageDamagePercent": round(mean_damage, 2),
            "damageCounts": damage_counts,
            "damagePercentages": {
                "Rusak Ringan": round((damage_counts["Rusak Ringan"] / total_buildings) * 100, 1),
                "Rusak Sedang": round((damage_counts["Rusak Sedang"] / total_buildings) * 100, 1),
                "Rusak Berat": round((damage_counts["Rusak Berat"] / total_buildings) * 100, 1),
            }
        },
        "componentVulnerability": vuln_list,
        "priorityRankings": priority_counts,
        "topPriorityBuildings": scored_buildings[:10],
        "kecamatanStats": kec_summary,
        "recommendations": recommendations
    }

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"success": False, "message": "Input JSON kosong"}))
            return
        payload = json.loads(raw_input)
        # Accept list directly or object { "assessments": [...] }
        assessments = payload if isinstance(payload, list) else payload.get("assessments", [])
        result = analyze_assessments(assessments)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "engine": "Python 3 Analytics Engine"
        }))

if __name__ == '__main__':
    main()
