import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

def generate_pdf_report(
    dest_path: str, 
    country_name: str, 
    country_code: str, 
    history_data: list, 
    forecast_data: list, 
    insights: str,
    risk_scores: dict,
    correlation: dict,
    peers: list,
    extra_metrics: dict,
    cluster_id: int,
    fuel_mix: dict,
    attention: dict,
    shap_data: dict,
    simulation: dict
) -> str:
    # Setup document
    doc = SimpleDocTemplate(
        dest_path,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles matching our premium design system
    title_style = ParagraphStyle(
        'AcademicTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#0f172a"), # Dark Slate
        alignment=1, # Center
        spaceAfter=4
    )
    
    meta_style = ParagraphStyle(
        'MetaText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#475569"),
        alignment=1, # Center
        spaceAfter=12
    )
    
    h1_style = ParagraphStyle(
        'AcademicH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'AcademicBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6
    )

    italic_desc_style = ParagraphStyle(
        'ItalicDesc',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#475569"),
        spaceAfter=6
    )

    abstract_style = ParagraphStyle(
        'AbstractText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=10
    )

    th_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        textColor=colors.white,
        alignment=1
    )

    td_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        textColor=colors.HexColor("#1e293b"),
        alignment=1
    )

    formula_style = ParagraphStyle(
        'FormulaText',
        parent=styles['Normal'],
        fontName='Courier-Bold',
        fontSize=8.5,
        textColor=colors.HexColor("#0f172a"),
        alignment=1,
        spaceBefore=4,
        spaceAfter=4
    )

    story = []
    
    # Define cluster name maps
    CLUSTER_NAMES = [
        "Fossil-Intensive Grid Systems",
        "Expanding & Transitioning Energy Systems",
        "Low-Carbon & Renewable-Driven Grid Systems"
    ]
    CLUSTER_DESCS = [
        "Electricity systems where coal, natural gas, or oil remain the dominant sources of generation. Renewable deployment is growing in many countries, but fossil fuels continue to provide most baseload electricity.",
        "Electricity systems experiencing rapid demand growth and ongoing infrastructure expansion, with increasing investment in renewable energy while maintaining a diversified generation mix.",
        "Electricity systems characterized by a high share of low-carbon generation—including hydro, wind, solar, geothermal, and nuclear—supporting lower emissions and advanced energy transition progress."
    ]
    cluster_name = CLUSTER_NAMES[cluster_id] if 0 <= cluster_id < len(CLUSTER_NAMES) else "Unclassified Grid Segment"
    cluster_desc = CLUSTER_DESCS[cluster_id] if 0 <= cluster_id < len(CLUSTER_DESCS) else "No segment details."

    # ---------------- PAGE 1 ----------------
    # Header & Title Banner
    story.append(Spacer(1, 0.02*inch))
    story.append(Paragraph("EnerVision Sovereign Energy Transition Intelligence Booklet", title_style))
    story.append(Paragraph(f"Sovereign Transition Profile & Risk Audit  |  Published: June 2026", meta_style))
    story.append(Spacer(1, 0.02*inch))
    
    # Executive Abstract
    story.append(Paragraph("Abstract", h1_style))
    pop_m = extra_metrics.get("population", 1.0) / 1e6
    gdp_t = extra_metrics.get("gdp", 0.0) / 1e12
    gdp_pc = extra_metrics.get("gdp_per_capita", 0.0)
    ev_share = extra_metrics.get("ev_share", 0.0)
    
    abstract_text = (
        f"This intelligence booklet compiles the historical energy baseline, temporal segment clustering, "
        f"multi-scenario simulation comparisons, and 20-year deep learning forecasts for {country_name} ({country_code}). "
        f"With a population of {pop_m:.1f} Million and nominal GDP of ${gdp_t:.3f} Trillion (yielding ${gdp_pc:,.0f} per capita), "
        f"the sovereign's transition readiness, import supply vulnerability, and carbon decoupling vectors are audited "
        f"to formulate strategic action plans for policymakers."
    )
    story.append(Paragraph(abstract_text, abstract_style))
    
    # KMeans Clustering Profile
    story.append(Paragraph("1. KMeans Regional Energy Segment Assignment", h1_style))
    story.append(Paragraph(
        f"Applying global KMeans segmentation over GDP per capita, emissions, and clean power shares across "
        f"156 countries, {country_name} is assigned to:", body_style
    ))
    
    cluster_box = [
        [Paragraph(f"<b>Segment Group ID {cluster_id}: {cluster_name}</b>", th_style)],
        [Paragraph(cluster_desc, td_style)]
    ]
    t_cluster = Table(cluster_box, colWidths=[6.6*inch])
    t_cluster.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0f172a")),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor("#f1f5f9")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_cluster)
    story.append(Spacer(1, 0.05*inch))
    
    # Section 1: Calibrated Transition Risk Scorecard
    story.append(Paragraph("2. Calibrated Transition Risk Scorecard", h1_style))
    sup_r = risk_scores.get("supply_risk", 50)
    em_r = risk_scores.get("emission_risk", 50)
    readiness = risk_scores.get("transition_readiness", 50)
    
    resilience_rating = "High Resilience"
    if sup_r > 70 or em_r > 70:
        resilience_rating = "Low Grid Resilience"
    elif sup_r > 50 or em_r > 50 or readiness < 40:
        resilience_rating = "Moderate Grid Resilience"
        
    scorecard_content = [
        [Paragraph("Demographic Indicator", th_style), Paragraph("Value", th_style), Paragraph("Transition Index", th_style), Paragraph("Score", th_style)],
        [Paragraph("Sovereign Region", td_style), Paragraph(country_name, td_style), Paragraph("Supply Volatility Risk", td_style), Paragraph(f"{sup_r}%", td_style)],
        [Paragraph("Fossil fuel share", td_style), Paragraph(f"{extra_metrics.get('fossil_share', 0.0)*100:.1f}%", td_style), Paragraph("Emissions Intensity Risk", td_style), Paragraph(f"{em_r}%", td_style)],
        [Paragraph("Clean energy share", td_style), Paragraph(f"{extra_metrics.get('clean_share', 0.0)*100:.1f}%", td_style), Paragraph("Transition Readiness", td_style), Paragraph(f"{readiness}%", td_style)],
        [Paragraph("Calibrated EV Share", td_style), Paragraph(f"{ev_share:.1f}%", td_style), Paragraph("Grid Resilience Status", td_style), Paragraph(resilience_rating, td_style)]
    ]
    
    t_scorecard = Table(scorecard_content, colWidths=[1.8*inch, 1.5*inch, 1.9*inch, 1.4*inch])
    t_scorecard.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e293b")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_scorecard)
    story.append(Spacer(1, 0.05*inch))
    
    resilience_desc = (
        f"**Grid resilience assessment**: A fossil-heavy generation mix and import exposure limit immediate grid capacity. "
        f"Rapid EV charging corridor scaling may require local grid upgrades. To optimize grid stability, "
        f"policy advisors recommend deploying fast-charging corridor assets. "
    )
    if country_code == "IND":
        resilience_desc += (
            "For India specifically, Tata Power EZ Charge represents the dominant public and residential charging developer. "
            "Ather Grid and Ola Fast-Charging corridor networks are also highly recommended for electric two-wheelers."
        )
    story.append(Paragraph(resilience_desc.replace("**", "").replace("*", ""), body_style))
    story.append(PageBreak())
    
    # ---------------- PAGE 2 ----------------
    # Section 2: Fuel Mix Profile
    story.append(Paragraph("3. Historical Electricity Generation Fuel Mix", h1_style))
    fuel_intro = (
        f"The table below details {country_name}'s power generation mix recorded in the latest baseline year, "
        f"identifying the dominant fuel source and low-carbon grid ratios."
    )
    story.append(Paragraph(fuel_intro, body_style))
    
    coal_twh = fuel_mix.get("coal", 0.0)
    gas_twh = fuel_mix.get("gas", 0.0)
    solar_twh = fuel_mix.get("solar", 0.0)
    wind_twh = fuel_mix.get("wind", 0.0)
    hydro_twh = fuel_mix.get("hydro", 0.0)
    nuclear_twh = fuel_mix.get("nuclear", 0.0)
    total_twh = coal_twh + gas_twh + solar_twh + wind_twh + hydro_twh + nuclear_twh
    
    def get_share_pct(val):
        return (val / total_twh * 100.0) if total_twh > 0 else 0.0
        
    fuel_table_data = [
        [Paragraph("Generation Source", th_style), Paragraph("Capacity Value (TWh)", th_style), Paragraph("Mix Percentage (%)", th_style)],
        [Paragraph("Coal Power", td_style), Paragraph(f"{coal_twh:.1f}", td_style), Paragraph(f"{get_share_pct(coal_twh):.1f}%", td_style)],
        [Paragraph("Natural Gas", td_style), Paragraph(f"{gas_twh:.1f}", td_style), Paragraph(f"{get_share_pct(gas_twh):.1f}%", td_style)],
        [Paragraph("Solar PV", td_style), Paragraph(f"{solar_twh:.1f}", td_style), Paragraph(f"{get_share_pct(solar_twh):.1f}%", td_style)],
        [Paragraph("Wind Energy", td_style), Paragraph(f"{wind_twh:.1f}", td_style), Paragraph(f"{get_share_pct(wind_twh):.1f}%", td_style)],
        [Paragraph("Hydroelectric", td_style), Paragraph(f"{hydro_twh:.1f}", td_style), Paragraph(f"{get_share_pct(hydro_twh):.1f}%", td_style)],
        [Paragraph("Nuclear Fission", td_style), Paragraph(f"{nuclear_twh:.1f}", td_style), Paragraph(f"{get_share_pct(nuclear_twh):.1f}%", td_style)],
        [Paragraph("<b>Total System</b>", td_style), Paragraph(f"<b>{total_twh:.1f}</b>", td_style), Paragraph("<b>100.0%</b>", td_style)]
    ]
    t_fuel = Table(fuel_table_data, colWidths=[2.2*inch, 2.2*inch, 2.2*inch])
    t_fuel.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e293b")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_fuel)
    story.append(Spacer(1, 0.05*inch))
    
    # Section 3: Pearson Correlation Matrix
    story.append(Paragraph("4. Structural Decoupling & Pearson Correlation Matrix", h1_style))
    corr_intro = (
        f"Pearson correlation coefficients (\\(r\\)) calculated over historical timeseries (1990-2024) "
        f"measure the link between GDP, Emissions, Renewables, and Electricity Demand."
    )
    story.append(Paragraph(corr_intro, body_style))
    
    story.append(Paragraph("Pearson Coefficient Formula:", italic_desc_style))
    story.append(Paragraph("r = [ Σ(x - x̄)(y - ȳ) ] / √[ Σ(x - x̄)² Σ(y - ȳ)² ]", formula_style))
    story.append(Spacer(1, 0.02*inch))
    
    corr_labels = correlation["labels"]
    corr_matrix = correlation["matrix"]
    
    corr_table_data = [
        [Paragraph("", th_style)] + [Paragraph(lbl, th_style) for lbl in corr_labels]
    ]
    for r_idx, row_vals in enumerate(corr_matrix):
        row = [Paragraph(corr_labels[r_idx], th_style)]
        for val in row_vals:
            row.append(Paragraph(f"{val:+.2f}", td_style))
        corr_table_data.append(row)
        
    t_corr = Table(corr_table_data, colWidths=[1.4*inch, 1.3*inch, 1.3*inch, 1.3*inch, 1.3*inch])
    t_style_cmds = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e293b")),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#1e293b")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]
    for c in range(1, 5):
        t_style_cmds.append(('TEXTCOLOR', (c, 0), (c, 0), colors.white))
        t_style_cmds.append(('FONTNAME', (c, 0), (c, 0), 'Helvetica-Bold'))
    for r in range(1, 5):
        t_style_cmds.append(('TEXTCOLOR', (0, r), (0, r), colors.white))
        t_style_cmds.append(('FONTNAME', (0, r), (0, r), 'Helvetica-Bold'))
        
    for r in range(1, 5):
        for c in range(1, 5):
            val = corr_matrix[r-1][c-1]
            if val > 0.05:
                if val > 0.8:
                    cell_bg = colors.HexColor("#a7f3d0")
                    cell_text = colors.HexColor("#065f46")
                elif val > 0.5:
                    cell_bg = colors.HexColor("#d1fae5")
                    cell_text = colors.HexColor("#065f46")
                else:
                    cell_bg = colors.HexColor("#ecfdf5")
                    cell_text = colors.HexColor("#047857")
            elif val < -0.05:
                if val < -0.8:
                    cell_bg = colors.HexColor("#fecaca")
                    cell_text = colors.HexColor("#991b1b")
                elif val < -0.5:
                    cell_bg = colors.HexColor("#fee2e2")
                    cell_text = colors.HexColor("#991b1b")
                else:
                    cell_bg = colors.HexColor("#fef2f2")
                    cell_text = colors.HexColor("#b91c1c")
            else:
                cell_bg = colors.HexColor("#f8fafc")
                cell_text = colors.HexColor("#64748b")
            t_style_cmds.append(('BACKGROUND', (c, r), (c, r), cell_bg))
            t_style_cmds.append(('TEXTCOLOR', (c, r), (c, r), cell_text))
            t_style_cmds.append(('FONTNAME', (c, r), (c, r), 'Helvetica-Bold'))
            
    t_corr.setStyle(TableStyle(t_style_cmds))
    story.append(t_corr)
    story.append(PageBreak())
    
    # ---------------- PAGE 3 ----------------
    # Section 4: Projections Table
    story.append(Paragraph("5. AI Ensemble Decadal Projections (2025 - 2045)", h1_style))
    proj_intro = (
        f"Consolidated future demand projections, emissions intensities, and renewable share targets "
        f"modeled via our auto-ensemble ML pipeline."
    )
    story.append(Paragraph(proj_intro, body_style))
    
    combined_table_content = [
        [Paragraph("Year", th_style), Paragraph("Proj. Demand (TWh)", th_style), Paragraph("Proj. Emissions (MT)", th_style), Paragraph("Proj. Renewables Share", th_style)]
    ]
    target_years = [2025, 2030, 2035, 2040, 2045]
    for row in forecast_data:
        if row['year'] in target_years:
            combined_table_content.append([
                Paragraph(f"{row['year']} (Proj)", td_style),
                Paragraph(f"{row.get('electricity_demand', 0.0):.1f}", td_style),
                Paragraph(f"{row.get('co2_emissions', 0.0):.1f}", td_style),
                Paragraph(f"{row.get('renewable_share', 0.0)*100:.1f}%", td_style),
            ])
            
    t_comb = Table(combined_table_content, colWidths=[1.4*inch, 1.8*inch, 1.8*inch, 1.6*inch])
    t_comb.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e293b")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_comb)
    story.append(Spacer(1, 0.05*inch))
    
    # Section 5: PyTorch LSTM Attention Weights
    story.append(Paragraph("6. PyTorch LSTM Temporal Self-Attention weights", h1_style))
    att_intro = (
        f"Deep recurrent networks use self-attention weights over a 5-year lag sequence to dictate "
        f"future forecasts. Higher weight highlights years containing major structural shifts."
    )
    story.append(Paragraph(att_intro, body_style))
    
    att_years = attention.get("years", [2020, 2021, 2022, 2023, 2024])
    att_weights = attention.get("attention", [0.2, 0.2, 0.2, 0.2, 0.2])
    
    att_table_data = [
        [Paragraph("Lag Year", th_style), Paragraph("Attention Weight (%)", th_style), Paragraph("Relative Strength", th_style)]
    ]
    for idx, y in enumerate(att_years):
        wt = att_weights[idx]
        strength = "Medium"
        if wt > 0.25:
            strength = "High"
        elif wt < 0.15:
            strength = "Low"
            
        att_table_data.append([
            Paragraph(str(y), td_style),
            Paragraph(f"{wt*100:.1f}%", td_style),
            Paragraph(strength, td_style)
        ])
        
    t_att = Table(att_table_data, colWidths=[2.2*inch, 2.2*inch, 2.2*inch])
    
    att_style_cmds = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0f172a")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
    ]
    for idx in range(len(att_years)):
        wt = att_weights[idx]
        bg_op = min(0.8, max(0.12, wt * 3.0))
        att_style_cmds.append(('BACKGROUND', (0, idx+1), (-1, idx+1), colors.Color(0.0, 242.0/255.0, 254.0/255.0, bg_op)))
        att_style_cmds.append(('TEXTCOLOR', (0, idx+1), (-1, idx+1), colors.HexColor("#0f172a")))
        
    t_att.setStyle(TableStyle(att_style_cmds))
    story.append(t_att)
    story.append(Spacer(1, 0.05*inch))
    
    # Section 6: XGBoost SHAP Explainability
    story.append(Paragraph("7. XGBoost SHAP Feature Attributions (Forecast Explainability)", h1_style))
    shap_intro = (
        f"Shapley Additive exPlanations (SHAP) measure feature impacts driving the first forecast step prediction (2025). "
        f"Attribution values push predictions up (+) or down (-) relative to the model's base value."
    )
    story.append(Paragraph(shap_intro, body_style))
    
    # Fetch SHAP attributions
    sh_attrs = shap_data.get("attributions", {"GDP": 0.35, "ev_sales_share": -0.22, "emissions_lag_1": 0.15, "population": 0.12})
    sorted_attrs = sorted(sh_attrs.items(), key=lambda x: abs(x[1]), reverse=True)[:4]
    
    shap_table_content = [
        [Paragraph("Feature Variable Indicator", th_style), Paragraph("SHAP Attribution value", th_style), Paragraph("Directional Impact", th_style)]
    ]
    for feat, val in sorted_attrs:
        impact = "Positive (Pushes output up)" if val > 0 else "Negative (Displaces output down)"
        shap_table_content.append([
            Paragraph(feat, td_style),
            Paragraph(f"{val:+.3f}", td_style),
            Paragraph(impact, td_style)
        ])
        
    t_shap = Table(shap_table_content, colWidths=[2.2*inch, 2.2*inch, 2.2*inch])
    t_shap.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e293b")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_shap)
    story.append(PageBreak())
    
    # ---------------- PAGE 4 ----------------
    # Section 7: Peer Benchmarking (Proximity Explorer)
    story.append(Paragraph("8. Sovereign Peer Proximity Benchmark", h1_style))
    peer_intro = (
        f"Top 3 closest sovereigns to {country_name} in 2D normalized Euclidean space "
        f"(GDP per capita vs. Renewable share)."
    )
    story.append(Paragraph(peer_intro, body_style))
    
    peer_table_data = [
        [Paragraph("Rank", th_style), Paragraph("Peer Country", th_style), Paragraph("GDP per Capita", th_style), Paragraph("Renewable Share", th_style), Paragraph("Similarity Index", th_style)]
    ]
    for idx, p in enumerate(peers):
        peer_table_data.append([
            Paragraph(f"#{idx + 1}", td_style),
            Paragraph(f"{p['country']} ({p['code']})", td_style),
            Paragraph(f"${p['gdp_per_capita']:,.0f}", td_style),
            Paragraph(f"{p['renewable_share']*100:.1f}%", td_style),
            Paragraph(f"{p['similarity']:.1f}%", td_style)
        ])
    t_peers = Table(peer_table_data, colWidths=[1.0*inch, 1.8*inch, 1.4*inch, 1.4*inch, 1.0*inch])
    t_peers.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0f172a")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_peers)
    story.append(Spacer(1, 0.05*inch))
    
    # Section 8: Policy Simulation
    story.append(Paragraph("9. Policy Shift Simulation & Sensitivity Analysis", h1_style))
    sim_intro = (
        f"Hypothetical Decarbonization Policy Shift (Solar Capacity +20%, EV Sales Share +15%, Coal Generation -20%) "
        f"benchmarked against the baseline ensemble projections for year 2045."
    )
    story.append(Paragraph(sim_intro, body_style))
    
    # Compute simulation comparison row values
    last_fore = forecast_data[-1] if forecast_data else {}
    base_dem_45 = last_fore.get("electricity_demand", 0.0)
    base_em_45 = last_fore.get("co2_emissions", 0.0)
    base_ren_45 = last_fore.get("renewable_share", 0.0)
    
    sim_dem_45 = 0.0
    sim_em_45 = 0.0
    sim_ren_45 = 0.0
    if simulation:
        sim_dem_45 = simulation.get("electricity_demand", [])[-1].get("value", 0.0)
        sim_em_45 = simulation.get("co2_emissions", [])[-1].get("value", 0.0)
        sim_ren_45 = simulation.get("renewable_share", [])[-1].get("value", 0.0)
        
    def get_pct_delta(s_v, b_v):
        return ((s_v - b_v) / b_v * 100.0) if b_v > 0 else 0.0
        
    sim_table_data = [
        [Paragraph("Target Metric", th_style), Paragraph("Baseline 2045", th_style), Paragraph("Simulated 2045", th_style), Paragraph("Delta (%)", th_style)],
        [Paragraph("Electricity Demand (TWh)", td_style), Paragraph(f"{base_dem_45:.1f}", td_style), Paragraph(f"{sim_dem_45:.1f}", td_style), Paragraph(f"{get_pct_delta(sim_dem_45, base_dem_45):+.1f}%", td_style)],
        [Paragraph("CO2 Emissions (MT)", td_style), Paragraph(f"{base_em_45:.1f}", td_style), Paragraph(f"{sim_em_45:.1f}", td_style), Paragraph(f"{get_pct_delta(sim_em_45, base_em_45):+.1f}%", td_style)],
        [Paragraph("Renewable Share (%)", td_style), Paragraph(f"{base_ren_45*100.0:.1f}%", td_style), Paragraph(f"{sim_ren_45*100.0:.1f}%", td_style), Paragraph(f"{(sim_ren_45 - base_ren_45)*100.0:+.1f}%", td_style)]
    ]
    t_sim = Table(sim_table_data, colWidths=[2.0*inch, 1.5*inch, 1.5*inch, 1.6*inch])
    t_sim.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e293b")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_sim)
    story.append(Spacer(1, 0.05*inch))
    
    # Strategic Action Plan
    story.append(Paragraph("Strategic Policy Directives:", italic_desc_style))
    clean_insights = insights.replace("**", "").replace("* ", "• ").replace("#", "")
    for line in clean_insights.split("\n\n"):
        if line.strip():
            story.append(Paragraph(line.strip(), body_style))
            
    # Page numbering / header footer callback
    def add_header_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica-Bold', 8)
        canvas.setFillColor(colors.HexColor("#475569"))
        canvas.drawString(54, letter[1] - 36, "EnerVision AI Transition Intelligence Report")
        canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
        canvas.setLineWidth(0.5)
        canvas.line(54, letter[1] - 40, letter[0] - 54, letter[1] - 40)
        
        canvas.line(54, 45, letter[0] - 54, 45)
        canvas.setFont('Helvetica', 8)
        canvas.drawString(54, 32, "Confidential | Compiled by EnerVision AI Collaborative Agents")
        canvas.drawRightString(letter[0] - 54, 32, f"Page {doc.page} of 4")
        canvas.restoreState()
        
    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    return dest_path
