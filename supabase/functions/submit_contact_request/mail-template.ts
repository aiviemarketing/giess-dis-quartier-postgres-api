export const mailTemplate = (
	username: string,
	message: string,
	email: string
) => `
<!DOCTYPE html>
<html lang="de">
	<head>
		<meta charset="UTF-8" />
	</head>
	<body>
		<table
			width="100%"
			style="
				font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
				-webkit-box-sizing: border-box;
				box-sizing: border-box;
				width: 100%;
				margin: 0;
				padding: 0;
				background-color: #f2f4f6;
			"
			class="email-wrapper"
			cellspacing="0"
			cellpadding="0"
			bgcolor="#F2F4F6"
		>
			<tbody>
				<tr>
					<td
						style="
							font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
							-webkit-box-sizing: border-box;
							box-sizing: border-box;
						"
						align="center"
					>
						<table
							width="100%"
							style="
								font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
								-webkit-box-sizing: border-box;
								box-sizing: border-box;
								width: 100%;
								margin: 0;
								padding: 0;
							"
							class="email-content"
							cellspacing="0"
							cellpadding="0"
						>
							<tbody>
								<tr>
									<td
										style="
											font-family: Arial, 'Helvetica Neue', Helvetica,
												sans-serif;
											-webkit-box-sizing: border-box;
											box-sizing: border-box;
											padding: 25px 0;
											text-align: center;
										"
										class="email-masthead"
										align="center"
									>
										<a
											style="
												font-family: Arial, 'Helvetica Neue', Helvetica,
													sans-serif;
												-webkit-box-sizing: border-box;
												box-sizing: border-box;
												font-size: 16px;
												font-weight: bold;
												color: #2f3133;
												text-decoration: none;
												text-shadow: 0 1px 0 white;
											"
											href="{{ .SiteURL }}"
											class="email-masthead_name"
										>
											<img
												style="
													font-family: Arial, 'Helvetica Neue', Helvetica,
														sans-serif;
													-webkit-box-sizing: border-box;
													box-sizing: border-box;
													max-height: 50px;
												"
												src="{{ .SiteURL }}/images/icon-trees.svg"
												class="email-logo"
												alt=""
											/>
										</a>
									</td>
								</tr>

								<tr>
									<td
										width="100%"
										style="
											font-family: Arial, 'Helvetica Neue', Helvetica,
												sans-serif;
											-webkit-box-sizing: border-box;
											box-sizing: border-box;
											width: 100%;
											margin: 0;
											padding: 0;
											border-top: 1px solid #edeff2;
											border-bottom: 1px solid #edeff2;
											background-color: #fff;
										"
										class="email-body"
										bgcolor="#FFF"
									>
										<table
											width="570"
											style="
												font-family: Arial, 'Helvetica Neue', Helvetica,
													sans-serif;
												-webkit-box-sizing: border-box;
												box-sizing: border-box;
												width: 570px;
												margin: 0 auto;
												padding: 0;
											"
											class="email-body_inner"
											cellspacing="0"
											cellpadding="0"
											align="center"
										>
											<tbody>
												<tr>
													<td
														style="
															font-family: Arial, 'Helvetica Neue', Helvetica,
																sans-serif;
															-webkit-box-sizing: border-box;
															box-sizing: border-box;
															padding: 35px 35px 0px 35px;
														"
														class="content-cell"
													>
                                                        <p>
                                                            Kontaktanfrage auf Güss dis Quartier
                                                        </p>
														<p>
															* * * For the English version of this email, please see below. * * *
														</p>
														<h1
															style="
																margin-top: 0;
																color: #2f3133;
																font-size: 19px;
																font-weight: bold;
																font-family: Arial, 'Helvetica Neue', Helvetica,
																	sans-serif;
																-webkit-box-sizing: border-box;
																box-sizing: border-box;
															"
														>
															Güss dis
															<span style="color: #37de8a">Quartier</span>
														</h1>

														<p
															style="
																margin-top: 0;
																color: #000;
																font-size: 16px;
																line-height: 1.5em;
																font-family: Arial, 'Helvetica Neue', Helvetica,
																	sans-serif;
																-webkit-box-sizing: border-box;
																box-sizing: border-box;
															"
														>
															<span style="font-weight: bold;">${username}</span> möchte sich
															mit Dir vernetzen und hat Dir folgende Nachricht gesendet:

															<div
																style="margin-top: 25px; margin-bottom: 25px; padding: 10px; background-color: lightgrey; border-radius: 10px"
															>
																${message}</div
															>

															Um dem Nutzer per E-Mail zu antworten, schreibe bitte an:
															<div style="margin-top: 25px; margin-bottom: 25px;"><a href="mailto:${email}" >${email}</a></div>

                                                            <i style="
                                                                margin-top: 0;
                                                                line-height: 1.5em;
                                                                font-family: Arial, 'Helvetica Neue', Helvetica,
                                                                    sans-serif;
                                                                -webkit-box-sizing: border-box;
                                                                box-sizing: border-box;
                                                                color: #aeaeae;
                                                                font-size: 14px;
                                                                text-align: center;">
                                                                Sollte die Kontaktanfrage unangemessene Inhalte enthalten, tut uns das sehr leid. Bitte informiere unverzüglich unser Team über info@citylab-berlin.org.
                                                            </i> 
														</p>

														<br />
														<hr style="width: 100%; border-bottom: 1px" />
														<br />

														<h1
															style="
																margin-top: 0;
																color: #2f3133;
																font-size: 19px;
																font-weight: bold;
																font-family: Arial, 'Helvetica Neue', Helvetica,
																	sans-serif;
																-webkit-box-sizing: border-box;
																box-sizing: border-box;
															"
														>
															Güss dis
															<span style="color: #37de8a">Quartier</span>
														</h1>

														<p
															style="
																margin-top: 0;
																color: #000;
																font-size: 16px;
																line-height: 1.5em;
																font-family: Arial, 'Helvetica Neue', Helvetica,
																	sans-serif;
																-webkit-box-sizing: border-box;
																box-sizing: border-box;
															"
														>
                                                        <span style="font-weight: bold;">${username}</span> would like to connect with you
                                                        and has sent you the following message:

                                                        <div
                                                            style="margin-top: 25px; margin-bottom: 25px; padding: 10px; background-color: lightgrey; border-radius: 10px"
                                                        >
                                                            ${message}</div
                                                        >

                                                        To reply to the user via e-mail, please write to:
                                                        <div style="margin-top: 25px; margin-bottom: 25px;"><a href="mailto:${email}" >${email}</a></div>
                                                        
                                                        <i style="
                                                        margin-top: 0;
                                                        line-height: 1.5em;
                                                        font-family: Arial, 'Helvetica Neue', Helvetica,
                                                            sans-serif;
                                                        -webkit-box-sizing: border-box;
                                                        box-sizing: border-box;
                                                        color: #aeaeae;
                                                        font-size: 14px;
                                                        text-align: center;">We apologize if the contact request contains inappropriate content. Please notify our team immediately via info@aivie.ch.</i>
														</p>

														<p
															style="
																margin-top: 0;
																color: #74787e;
																font-size: 13px;
																line-height: 1em;
																font-family: Arial, 'Helvetica Neue', Helvetica,
																	sans-serif;
																-webkit-box-sizing: border-box;
																box-sizing: border-box;
																padding-top: 1rem;
															"
														>
															Aivie by Idea 2 Collective GmbH
															<br />
															Wengistrasse 6
															<br />
															8004 Zürich
															<br />
															Tel.:
															<a style="color: unset" href="tel:+493020969990"
																>+41 43 883 06 72</a
															>
															<br />
															<a
																style="color: unset"
																href="mailto:info@aivie.ch"
																>info@aivie.ch</a
															>
															<br />
															<br />
														</p>
													</td>
												</tr>
											</tbody>
										</table>
									</td>
								</tr>

								<tr>
									<td
										style="
											font-family: Arial, 'Helvetica Neue', Helvetica,
												sans-serif;
											-webkit-box-sizing: border-box;
											box-sizing: border-box;
										"
									>
										<table
											width="570"
											style="
												font-family: Arial, 'Helvetica Neue', Helvetica,
													sans-serif;
												-webkit-box-sizing: border-box;
												box-sizing: border-box;
												width: 570px;
												margin: 0 auto;
												padding: 0;
												text-align: center;
											"
											class="email-footer"
											cellspacing="0"
											cellpadding="0"
											align="center"
										>
											<tbody>
												<tr>
													<td
														style="
															font-family: Arial, 'Helvetica Neue', Helvetica,
																sans-serif;
															-webkit-box-sizing: border-box;
															box-sizing: border-box;
															padding: 35px;
														"
														class="content-cell"
													>
														<p
															style="
																margin-top: 0;
																line-height: 1.5em;
																font-family: Arial, 'Helvetica Neue', Helvetica,
																	sans-serif;
																-webkit-box-sizing: border-box;
																box-sizing: border-box;
																color: #aeaeae;
																font-size: 12px;
																text-align: center;
															"
															class="sub center"
														>
                                                        <i
                                                        style="
                                                            font-family: Arial, 'Helvetica Neue',
                                                                Helvetica, sans-serif;
                                                            -webkit-box-sizing: border-box;
                                                            box-sizing: border-box;
                                                        "
                                                    >
                                                        Güss dis Quartier ist eine Anwendung, die hilft,
                                                        ehrenamtliches Engagement beim Giessen durstiger
                                                        Stadtbäume zu koordinieren. Güss dis Quartier
																wird gesponsort und betrieben von 
																<a
																	style="color: unset"
																	href="https://aivie.ch/?utm_source=gdq&utm_medium=gdq-app&utm_campaign=human&utm_content=email-reset-password-de"
																	>Aivie</a
																>.
                                                    </i>
														</p>
													</td>
												</tr>
											</tbody>
										</table>
									</td>
								</tr>
							</tbody>
						</table>
					</td>
				</tr>
			</tbody>
		</table>
	</body>
</html>
`;
